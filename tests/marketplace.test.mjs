import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {openStore} from '../backend/store.ts';
import {Marketplace,ApiError} from '../backend/service.ts';

const machine={make:'Example',model:'Laser',year:'2024',askingPrice:'9500',category:'Laser hair removal',location:'London',condition:'Test condition',accessories:'',history:''};
const setup=async()=>{const db=await openStore(':memory:');return {db,service:new Marketplace(db)};};
async function users(s){const a=await s.register({email:'seller@example.test',name:'Seller',password:'long-test-password'});const b=await s.register({email:'other@example.test',name:'Other',password:'other-test-password'});return [a,b];}
function status(code){return e=>e instanceof ApiError&&e.status===code;}

test('passwords are hashed, sessions can expire and logout revokes access',async t=>{
  const {db,service:s}=await setup();
  t.after(()=>db.close());
  const [a]=await users(s);
  assert.equal((await s.user(a.token)).email,'seller@example.test');
  const stored=await db.get('SELECT password_hash FROM users WHERE id=?',a.user.id);
  assert.notEqual(stored.password_hash,'long-test-password');
  await assert.rejects(s.login({email:a.user.email,password:'wrong password'}),status(401));
  const login=await s.login({email:a.user.email,password:'long-test-password'});
  await s.logout(login.token);
  await assert.rejects(s.user(login.token),status(401));
  await db.run('UPDATE sessions SET expires_at=0');
  await assert.rejects(s.user(a.token),status(401));
});

test('ownership protects drafts, photos and state transitions',async t=>{
  const {db,service:s}=await setup();
  t.after(()=>db.close());
  const [a,b]=await users(s);
  const listing=await s.save(a.user,machine);
  assert.equal((await s.mine(b.user)).length,0);
  await assert.rejects(s.save(b.user,machine,listing.id),status(404));
  await assert.rejects(s.submit(b.user,listing.id),status(404));
  const photo=await s.addPhoto(a.user,listing.id,new Uint8Array([1,2]));
  await assert.rejects(s.photo(photo,b.user),status(404));
  await assert.rejects(s.photo(photo),status(404));
  await assert.rejects(s.removePhoto(b.user,listing.id,photo),status(404));
  assert.deepEqual(await s.photo(photo,a.user),new Uint8Array([1,2]));
});

test('submission derives fee, requires photos and never publishes unpaid equipment',async t=>{
  const {db,service:s}=await setup();
  t.after(()=>db.close());
  const [a]=await users(s);
  const {id,state}=await s.save(a.user,{...machine,state:'published',feePence:1,owner_id:'attacker'});
  assert.equal(state,'draft');
  await assert.rejects(s.submit(a.user,id),status(400));
  await s.addPhoto(a.user,id,new Uint8Array([1]));
  const submitted=await s.submit(a.user,id);
  assert.equal(submitted.state,'awaiting_payment');
  assert.equal(submitted.feePence,12000);
  assert.equal(submitted.packageId,'standard');
  assert.equal((await s.submit(a.user,id)).state,'awaiting_payment');
  assert.equal((await s.published()).length,0);
  await assert.rejects(s.save(a.user,machine,id),status(409));
  assert.equal((await s.returnToDraft(a.user,id)).state,'draft');
  assert.equal((await s.save(a.user,{...machine,askingPrice:'2000'},id)).data.askingPrice,'2000');
});

test('only live listings accept enquiries and only their seller receives them',async t=>{
  const {db,service:s}=await setup();
  t.after(()=>db.close());
  const [a,b]=await users(s);
  const {id}=await s.save(a.user,machine);
  const body={name:'Buyer',email:'buyer@example.test',message:'Please send service history.'};
  await assert.rejects(s.enquire(id,body),status(404));
  await db.run("UPDATE listings SET state='published',expires_at=? WHERE id=?",Date.now()+60000,id);
  const enquiry=await s.enquire(id,body);
  assert.equal((await s.inbox(a.user))[0].id,enquiry.id);
  assert.equal((await s.inbox(b.user)).length,0);
  assert.equal((await s.published()).length,1);
  await db.run('UPDATE listings SET expires_at=0 WHERE id=?',id);
  assert.equal((await s.published()).length,0);
  await assert.rejects(s.enquire(id,body),status(404));
});

test('validation and persisted rate limits reject abusive inputs',async t=>{
  const {db,service:s}=await setup();
  t.after(()=>db.close());
  const [a]=await users(s);
  for(const value of ['-1','0','1.999','Infinity','1e8']){
    await assert.rejects(s.save(a.user,{...machine,askingPrice:value}),status(400));
  }
  await assert.rejects(s.save(a.user,{...machine,category:'unknown'}),status(400));
  await s.rate('same',2);
  await s.rate('same',2);
  await assert.rejects(new Marketplace(db).rate('same',2),status(429));
  const listing=await s.save(a.user,{...machine,model:"'); DROP TABLE users; --"});
  assert.equal((await s.mine(a.user))[0].data.model,listing.data.model);
  assert.equal((await db.get('SELECT count(*) AS n FROM users')).n,2);
});

test('the driver preserves existing SQLite data across connections',async t=>{
  const directory=mkdtempSync(join(tmpdir(),'marketplace-'));
  t.after(()=>rmSync(directory,{recursive:true,force:true}));
  const file=join(directory,'marketplace.sqlite');
  const previous=new DatabaseSync(file);
  previous.exec("CREATE TABLE users(id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,name TEXT NOT NULL,password_hash TEXT NOT NULL,created_at INTEGER NOT NULL)");
  previous.prepare('INSERT INTO users VALUES(?,?,?,?,?)').run('existing','existing@example.test','Existing','fixture',1);
  previous.close();

  const store=await openStore(file);
  const service=new Marketplace(store);
  const existing={id:'existing',email:'existing@example.test',name:'Existing'};
  const listing=await service.save(existing,machine);
  const photo=await service.addPhoto(existing,listing.id,new Uint8Array([5,9]));
  store.close();

  const reopened=await openStore(file);
  try{
    const marketplace=new Marketplace(reopened);
    assert.equal((await marketplace.mine(existing))[0].id,listing.id);
    assert.deepEqual(await marketplace.photo(photo,existing),new Uint8Array([5,9]));
  }finally{reopened.close();}
});

test('verified PayPal capture publishes once and queues an email to both recipients',async t=>{
  const {startCheckout,paypalWebhook,captureCheckout}=await import('../backend/paypal.ts');
  const {sendPublicationEmail}=await import('../backend/publication-email.ts');
  const {db,service:s}=await setup();
  t.after(()=>db.close());
  const [seller,operator]=await users(s);
  const listing=await s.save(seller.user,machine);
  const photo=await s.addPhoto(seller.user,listing.id,new Uint8Array([1]));
  await s.submit(seller.user,listing.id);
  await db.run('INSERT INTO listing_operators VALUES(?)',operator.user.id);

  const config={APP_ORIGIN:'https://test.example',PAYPAL_MODE:'sandbox',PAYPAL_CLIENT_ID:'test',
    PAYPAL_CLIENT_SECRET:'test',PAYPAL_MERCHANT_ID:'merchant',PAYPAL_WEBHOOK_ID:'test-webhook',
    RESEND_API_KEY:'test',MARKETPLACE_EMAIL_FROM:'Listings <notifications@example.test>'};
  for(const [key,value] of Object.entries(config)){
    const previous=process.env[key];
    process.env[key]=value;
    t.after(()=>{if(previous===undefined)delete process.env[key];else process.env[key]=previous;});
  }

  let verified=false,captured=false,captures=0,charge='120.00',emailAttempts=0,voided=false,created=0;
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
      const id=++created===1?'oldorder':'order';
      return Response.json({id,links:[{rel:'payer-action',href:'https://www.sandbox.paypal.com/checkoutnow?token='+id}]});
    }
    if(path==='/v2/checkout/orders/oldorder')return Response.json({id:'oldorder',status:voided?'VOIDED':'CREATED'});
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

  await assert.rejects(()=>s.listingsForOperators(seller.user),status(403));
  assert.deepEqual((await s.listingsForOperators(operator.user)),[]);
  const first=await startCheckout(s,seller.user,listing.id);
  assert.match(first.approvalUrl,/oldorder$/);
  assert.deepEqual(await startCheckout(s,seller.user,listing.id),first);
  voided=true;
  assert.match((await startCheckout(s,seller.user,listing.id)).approvalUrl,/token=order$/);
  assert.equal(created,2);
  await assert.rejects(()=>s.returnToDraft(seller.user,listing.id),status(409));
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
  await db.run(`CREATE TRIGGER fail_publication_email BEFORE INSERT ON listing_publication_emails
    BEGIN SELECT RAISE(ABORT,'test rollback'); END`);
  await assert.rejects(paypalWebhook(s,headers,event),/test rollback/);
  assert.equal((await s.mine(seller.user))[0].state,'awaiting_payment');
  assert.equal((await db.get('SELECT capture_id FROM listing_payments')).capture_id,null);
  await db.run('DROP TRIGGER fail_publication_email');
  await paypalWebhook(s,headers,event);
  await paypalWebhook(s,headers,event);
  await captureCheckout(s,seller.user,listing.id,'order');
  assert.equal(captures,1);
  assert.equal((await s.mine(seller.user))[0].state,'published');
  assert.deepEqual((await s.listingsForOperators(operator.user))[0].flags,['The seller did not provide service or ownership history.']);
  assert.deepEqual((await s.photo(photo)),new Uint8Array([1]));
  assert.equal((await s.publishedListing(listing.id)).state,'published');
  assert.equal((await db.get('SELECT count(*) AS count FROM listing_publication_emails')).count,1);
  await assert.rejects(sendPublicationEmail(s,listing.id),status(503));
  assert.equal((await db.get('SELECT sent_at FROM listing_publication_emails')).sent_at,null);
  assert.equal((await s.publishedListing(listing.id)).state,'published');
  await sendPublicationEmail(s,listing.id);
  await sendPublicationEmail(s,listing.id);
  assert.equal(emailAttempts,2);
  assert.equal((await db.get('SELECT provider_id FROM listing_publication_emails')).provider_id,'email');
  const refund={id:'refund-event',event_type:'PAYMENT.CAPTURE.REFUNDED',
    resource:{links:[{rel:'up',href:'https://api-m.sandbox.paypal.com/v2/payments/captures/capture'}]}};
  verified=false;
  await assert.rejects(paypalWebhook(s,headers,refund),status(400));
  assert.ok(await s.publishedListing(listing.id));
  verified=true;
  await paypalWebhook(s,headers,refund);
  await paypalWebhook(s,headers,refund);
  assert.equal((await db.get('SELECT count(*) AS n FROM listing_payment_incidents')).n,1);
  assert.equal(await s.publishedListing(listing.id),undefined);
  assert.equal((await s.mine(seller.user))[0].state,'withdrawn');
  const [held]=await s.listingsForOperators(operator.user);
  assert.deepEqual(held.paymentIncidents,['PAYMENT.CAPTURE.REFUNDED']);
  await assert.rejects(s.photo(photo),status(404));
  assert.deepEqual(await s.photo(photo,operator.user,true),new Uint8Array([1]));
});

test('only operators can classify WordPress inventory and labels persist',async t=>{
  const {wordpressInventory,labelWordPressMachine}=await import('../backend/operator-inventory.ts');
  const {db,service}=await setup();
  t.after(()=>db.close());
  const [seller,operator]=await users(service);
  const key='MARKETPLACE_WORDPRESS_INVENTORY';
  const previous=process.env[key];
  t.after(()=>{if(previous===undefined)delete process.env[key];else process.env[key]=previous;});
  process.env[key]=JSON.stringify({capturedAt:'2026-11-13',machines:[
    {id:5390,title:'Example',slug:'example',status:'publish',source:'woocommerce_converted',pluginStatus:'approved',paymentStatus:'completed'},
    {id:10203,title:'Form listing',slug:'form-listing',status:'publish',source:'laser_market_form',pluginStatus:'approved',paymentStatus:'completed'}
  ]});
  assert.deepEqual((await wordpressInventory(service)).machines.map(machine=>machine.classification),['demo','genuine']);
  await assert.rejects(labelWordPressMachine(service,seller.user,'5390',{classification:'demo',note:'Confirmed'}),status(403));
  await db.run('INSERT INTO listing_operators VALUES(?)',operator.user.id);
  await assert.rejects(labelWordPressMachine(service,operator.user,'5390',{classification:'demo',note:''}),status(400));
  await labelWordPressMachine(service,operator.user,'5390',{classification:'genuine',note:'Verified exception'});
  assert.equal((await wordpressInventory(service)).machines[0].classification,'genuine');
  assert.equal((await db.get('SELECT operator_id FROM wordpress_inventory_labels')).operator_id,operator.user.id);
});

test('PIN alone opens a separate portal session and three failures lock all sessions',async t=>{
  const {scryptSync}=await import('node:crypto');
  const {requirePortalPin,unlockPortal,lockPortal}=await import('../backend/portal-pin.ts');
  const {db,service}=await setup();
  t.after(()=>db.close());
  const [seller,operator]=await users(service);
  await db.run('INSERT INTO listing_operators VALUES(?)',operator.user.id);
  for(const key of ['MARKETPLACE_PORTAL_PIN_HASH','MARKETPLACE_PORTAL_OPERATOR_EMAIL']){
    const previous=process.env[key];
    t.after(()=>{if(previous===undefined)delete process.env[key];else process.env[key]=previous;});
  }
  const salt='0'.repeat(32);
  process.env.MARKETPLACE_PORTAL_PIN_HASH=salt+':'+scryptSync('123456',salt,64).toString('hex');
  process.env.MARKETPLACE_PORTAL_OPERATOR_EMAIL=operator.user.email;
  await assert.rejects(requirePortalPin(service,seller.token),status(428));
  await assert.rejects(requirePortalPin(service,operator.token),status(428));
  await assert.rejects(unlockPortal(service,'000000'),status(403));
  const first=await unlockPortal(service,'123456');
  assert.equal((await requirePortalPin(service,first)).id,operator.user.id);
  await lockPortal(service,first);
  await assert.rejects(requirePortalPin(service,first),status(428));
  const second=await unlockPortal(service,'123456');
  await assert.rejects(unlockPortal(service,'000000'),status(403));
  await assert.rejects(unlockPortal(service,'000000'),status(403));
  await assert.rejects(unlockPortal(service,'000000'),status(423));
  await assert.rejects(unlockPortal(service,'123456'),status(423));
  await assert.rejects(requirePortalPin(service,second),status(423));
  assert.equal((await service.user(seller.token)).id,seller.user.id);
});

test('home machine groups follow published portal classifications and omit private fields',async t=>{
  const {homeMachines}=await import('../backend/home-machines.ts');
  const {db,service}=await setup();
  t.after(()=>db.close());
  const key='MARKETPLACE_WORDPRESS_INVENTORY',previous=process.env[key];
  t.after(()=>{if(previous===undefined)delete process.env[key];else process.env[key]=previous;});
  process.env[key]=JSON.stringify({capturedAt:'2026-11-13',machines:[
    {id:1,title:'Seller machine',status:'publish',source:'laser_market_form'},
    {id:2,title:'Example',status:'publish',source:'woocommerce_converted'},
    {id:3,title:'Draft',status:'draft',source:'laser_market_form'}
  ]});
  const machines=await homeMachines(service);
  assert.equal(machines.length,2);
  assert.equal(machines.find(machine=>machine.id==='wp-1').featured,true);
  assert.equal(machines.find(machine=>machine.id==='wp-2').href,undefined);
  assert.equal(machines.find(machine=>machine.id==='wp-2').price,null);
  assert.equal(machines.some(machine=>'contact' in machine||'note' in machine),false);
});
