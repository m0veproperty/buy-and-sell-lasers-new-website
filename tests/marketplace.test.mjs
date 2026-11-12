import {test} from 'node:test';
import assert from 'node:assert/strict';
import {openStore} from '../backend/store.ts';
import {Marketplace,ApiError} from '../backend/service.ts';

const machine={make:'Example',model:'Laser',year:'2024',askingPrice:'9500',category:'Laser hair removal',location:'London',condition:'Test condition',accessories:'',history:''};
const setup=()=>{const db=openStore(':memory:');return {db,service:new Marketplace(db)};};
async function users(s){const a=await s.register({email:'seller@example.test',name:'Seller',password:'long-test-password'});const b=await s.register({email:'other@example.test',name:'Other',password:'other-test-password'});return [a,b];}
function status(code){return e=>e instanceof ApiError&&e.status===code;}

test('passwords are hashed, sessions can expire and logout revokes access',async()=>{
 const {db,service:s}=setup();try{const [a]=await users(s);assert.equal(s.user(a.token).email,'seller@example.test');assert.notEqual(db.prepare('SELECT password_hash FROM users WHERE id=?').get(a.user.id).password_hash,'long-test-password');await assert.rejects(s.login({email:a.user.email,password:'wrong password'}),status(401));const login=await s.login({email:a.user.email,password:'long-test-password'});s.logout(login.token);assert.throws(()=>s.user(login.token),status(401));db.prepare('UPDATE sessions SET expires_at=0').run();assert.throws(()=>s.user(a.token),status(401));}finally{db.close();}
});
test('ownership protects drafts, photos, state transitions and inboxes',async()=>{
 const {db,service:s}=setup();try{const [a,b]=await users(s);const l=s.save(a.user,machine);assert.equal(s.mine(b.user).length,0);assert.throws(()=>s.save(b.user,machine,l.id),status(404));assert.throws(()=>s.submit(b.user,l.id),status(404));const p=s.addPhoto(a.user,l.id,new Uint8Array([1,2]));assert.throws(()=>s.photo(p,b.user),status(404));assert.throws(()=>s.photo(p),status(404));assert.throws(()=>s.removePhoto(b.user,l.id,p),status(404));assert.deepEqual(Array.from(s.photo(p,a.user)),[1,2]);}finally{db.close();}
});
test('submission derives fee, requires photos and never publishes unpaid equipment',async()=>{
 const {db,service:s}=setup();try{const [a]=await users(s);const l=s.save(a.user,{...machine,state:'published',feePence:1,owner_id:'attacker'});assert.equal(l.state,'draft');assert.throws(()=>s.submit(a.user,l.id),status(400));s.addPhoto(a.user,l.id,new Uint8Array([1]));const submitted=s.submit(a.user,l.id);assert.equal(submitted.state,'awaiting_payment');assert.equal(submitted.feePence,12000);assert.equal(submitted.packageId,'standard');assert.equal(s.submit(a.user,l.id).state,'awaiting_payment');assert.equal(s.published().length,0);assert.throws(()=>s.save(a.user,machine,l.id),status(409));assert.equal(s.returnToDraft(a.user,l.id).state,'draft');assert.equal(s.save(a.user,{...machine,askingPrice:'2000'},l.id).data.askingPrice,'2000');}finally{db.close();}
});
test('only live listings accept enquiries; only their seller receives the inbox record',async()=>{
 const {db,service:s}=setup();try{const [a,b]=await users(s);const l=s.save(a.user,machine);const body={name:'Buyer',email:'buyer@example.test',message:'Please send service history.'};assert.throws(()=>s.enquire(l.id,body),status(404));
 // Fixture only: there is deliberately no API to bypass payment or publish.
 db.prepare("UPDATE listings SET state='published',expires_at=? WHERE id=?").run(Date.now()+60000,l.id);
 const e=s.enquire(l.id,body);assert.equal(s.inbox(a.user)[0].id,e.id);assert.equal(s.inbox(b.user).length,0);assert.equal(s.published().length,1);db.prepare('UPDATE listings SET expires_at=0 WHERE id=?').run(l.id);assert.equal(s.published().length,0);assert.throws(()=>s.enquire(l.id,body),status(404));}finally{db.close();}
});
test('validation and persisted rate limits reject abusive inputs',async()=>{
 const {db,service:s}=setup();try{const [a]=await users(s);for(const value of ['-1','0','1.999','Infinity','1e8'])assert.throws(()=>s.save(a.user,{...machine,askingPrice:value}),status(400));assert.throws(()=>s.save(a.user,{...machine,category:'unknown'}),status(400));s.rate('same',2);s.rate('same',2);assert.throws(()=>new Marketplace(db).rate('same',2),status(429));const l=s.save(a.user,{...machine,model:"'); DROP TABLE users; --"});assert.equal(s.mine(a.user)[0].data.model,l.data.model);assert.equal(db.prepare('SELECT count(*) AS n FROM users').get().n,2);}finally{db.close();}
});

test('verified PayPal capture publishes once and queues an email to both recipients',async t=>{
  const {startCheckout,paypalWebhook,captureCheckout}=await import('../backend/paypal.ts');
  const {sendPublicationEmail}=await import('../backend/publication-email.ts');
  const {db,service:s}=setup();
  t.after(()=>db.close());
  const [seller,operator]=await users(s);
  const listing=s.save(seller.user,machine);
  const photo=s.addPhoto(seller.user,listing.id,new Uint8Array([1]));
  s.submit(seller.user,listing.id);
  db.prepare('INSERT INTO listing_operators VALUES(?)').run(operator.user.id);

  const config={APP_ORIGIN:'https://test.example',PAYPAL_MODE:'sandbox',PAYPAL_CLIENT_ID:'test',
    PAYPAL_CLIENT_SECRET:'test',PAYPAL_MERCHANT_ID:'merchant',PAYPAL_WEBHOOK_ID:'test-webhook',
    RESEND_API_KEY:'test',MARKETPLACE_EMAIL_FROM:'Listings <notifications@example.test>'};
  for(const [key,value] of Object.entries(config)){
    const previous=process.env[key];
    process.env[key]=value;
    t.after(()=>{if(previous===undefined)delete process.env[key];else process.env[key]=previous;});
  }

  let verified=false,captured=false,captures=0,charge='120.00',emailAttempts=0;
  t.mock.method(globalThis,'fetch',async (url,init)=>{
    const path=new URL(url).pathname;
    const amount={currency_code:'GBP',value:charge};
    if(url==='https://api.resend.com/emails'){
      emailAttempts++;
      assert.deepEqual(JSON.parse(init.body).to,['info@buyandselllasers.com','az@wiwy.com']);
      assert.match(JSON.parse(init.body).text,new RegExp('test.example/equipment/'+listing.id));
      assert.equal(init.headers['Idempotency-Key'],'marketplace-listing-published/'+listing.id);
      if(emailAttempts===1)return Response.json({}, {status:503});
      return Response.json({id:'email'});
    }
    if(path==='/v1/oauth2/token')return Response.json({access_token:'test-token'});
    if(path==='/v1/notifications/verify-webhook-signature'){
      return Response.json({verification_status:verified?'SUCCESS':'FAILURE'});
    }
    if(path==='/v2/checkout/orders'){
      assert.equal(JSON.parse(init.body).purchase_units[0].amount.value,'120.00');
      return Response.json({id:'order',links:[{rel:'payer-action',href:'https://www.sandbox.paypal.com/checkoutnow?token=order'}]});
    }
    if(path==='/v2/checkout/orders/order/capture'){
      captures++;
      captured=true;
      return Response.json({id:'order'});
    }
    assert.equal(path,'/v2/checkout/orders/order');
    return Response.json({id:'order',status:captured?'COMPLETED':'APPROVED',purchase_units:[{
      reference_id:listing.id,payee:{merchant_id:'merchant'},amount,
      payments:captured?{captures:[{id:'capture',status:'COMPLETED',amount}]}:undefined
    }]});
  });

  assert.throws(()=>s.publishedForOperators(seller.user),status(403));
  assert.deepEqual(s.publishedForOperators(operator.user),[]);
  await startCheckout(s,seller.user,listing.id);
  assert.throws(()=>s.returnToDraft(seller.user,listing.id),status(409));
  const headers=new Headers(Object.fromEntries(
    ['auth-algo','cert-url','transmission-id','transmission-sig','transmission-time'].map(key=>['paypal-'+key,'test'])
  ));
  const event={event_type:'CHECKOUT.ORDER.APPROVED',resource:{id:'order'}};
  await assert.rejects(paypalWebhook(s,headers,event),status(400));
  verified=true;
  charge='1.00';
  await assert.rejects(paypalWebhook(s,headers,event),status(409));
  assert.equal(captures,0);
  charge='120.00';
  await paypalWebhook(s,headers,event);
  await paypalWebhook(s,headers,event);
  await captureCheckout(s,seller.user,listing.id,'order');
  assert.equal(captures,1);
  assert.equal(s.mine(seller.user)[0].state,'published');
  assert.deepEqual(s.publishedForOperators(operator.user)[0].flags,['The seller did not provide service or ownership history.']);
  assert.deepEqual(s.photo(photo),new Uint8Array([1]));
  assert.equal(s.publishedListing(listing.id).state,'published');
  assert.equal(db.prepare('SELECT count(*) AS count FROM listing_publication_emails').get().count,1);
  await assert.rejects(sendPublicationEmail(s,listing.id),status(503));
  assert.equal(db.prepare('SELECT sent_at FROM listing_publication_emails').get().sent_at,null);
  assert.equal(s.publishedListing(listing.id).state,'published');
  await sendPublicationEmail(s,listing.id);
  await sendPublicationEmail(s,listing.id);
  assert.equal(emailAttempts,2);
  assert.equal(db.prepare('SELECT provider_id FROM listing_publication_emails').get().provider_id,'email');
});
