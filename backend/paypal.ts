import {randomUUID} from 'node:crypto';
import {listingPackages} from '../lib/listing-packages.ts';
import {ApiError,Marketplace,type Machine,type User} from './service.ts';

type Checkout = {
  listing_id:string;
  request_id:string;
  amount_pence:number;
  paypal_order_id:string|null;
  approval_url:string|null;
  capture_id:string|null;
};
type Order = {
  id:string;
  status:string;
  links?:{rel:string;href:string}[];
  purchase_units?:{
    reference_id:string;
    payee?:{merchant_id:string};
    amount?:{currency_code:string;value:string};
    payments?:{captures?:{id:string;status:string;amount:{currency_code:string;value:string}}[]};
  }[];
};

function config(){
  const {PAYPAL_CLIENT_ID:client,PAYPAL_CLIENT_SECRET:secret,PAYPAL_MERCHANT_ID:merchant,
    PAYPAL_WEBHOOK_ID:webhook,PAYPAL_MODE:mode,APP_ORIGIN:origin}=process.env;
  if(!client||!secret||!merchant||!webhook||!origin||!['sandbox','live'].includes(mode??'')){
    throw new ApiError(503,'PayPal checkout is not configured.');
  }
  return {client,secret,merchant,webhook,origin,mode,
    base:mode==='live'?'https://api-m.paypal.com':'https://api-m.sandbox.paypal.com'};
}

async function client(){
  const cfg=config();
  const tokenResponse=await fetch(cfg.base+'/v1/oauth2/token',{
    method:'POST',headers:{Authorization:'Basic '+Buffer.from(cfg.client+':'+cfg.secret).toString('base64'),
      'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=client_credentials',
    signal:AbortSignal.timeout(10000),cache:'no-store'
  });
  if(!tokenResponse.ok)throw new ApiError(502,'Could not authenticate with PayPal.');
  const {access_token:token}=await tokenResponse.json();
  return {
    ...cfg,
    async call<T>(path:string,body?:object,key?:string){
      const headers:Record<string,string>={Authorization:'Bearer '+token,'Content-Type':'application/json',Prefer:'return=representation'};
      if(key)headers['PayPal-Request-Id']=key;
      const response=await fetch(cfg.base+path,{
        method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined,
        signal:AbortSignal.timeout(10000),cache:'no-store'
      });
      if(!response.ok)throw new ApiError(502,'PayPal could not complete this request. Try again.');
      return await response.json() as T;
    }
  };
}

const amount=(pence:number)=>(pence/100).toFixed(2);
const orderPath=(id:string)=>'/v2/checkout/orders/'+encodeURIComponent(id);

function payment(service:Marketplace,id:string){
  return service.db.prepare('SELECT * FROM listing_payments WHERE listing_id=?').get(id) as Checkout|undefined;
}

export async function startCheckout(service:Marketplace,user:User,id:string){
  const row=service.owned(user,id);
  if(row.state!=='awaiting_payment'||!row.fee_pence)throw new ApiError(409,'Submit the listing before starting checkout.');
  const api=await client();
  service.db.prepare(`INSERT INTO listing_payments(listing_id,request_id,amount_pence)
    SELECT id,?,fee_pence FROM listings WHERE id=? AND state='awaiting_payment' AND fee_pence=?
    ON CONFLICT(listing_id) DO NOTHING`).run(randomUUID(),id,row.fee_pence);
  const checkout=payment(service,id);
  if(!checkout||checkout.capture_id)throw new ApiError(409,'Checkout is no longer available.');
  if(checkout.approval_url)return {approvalUrl:checkout.approval_url};

  const order=await api.call<Order>('/v2/checkout/orders',{
    intent:'CAPTURE',
    purchase_units:[{reference_id:id,amount:{currency_code:'GBP',value:amount(checkout.amount_pence)}}],
    payment_source:{paypal:{experience_context:{user_action:'PAY_NOW',
      return_url:new URL('/account?paypalListing='+encodeURIComponent(id),api.origin).href,
      cancel_url:new URL('/account',api.origin).href}}}
  },checkout.request_id);
  const link=order.links?.find(item=>item.rel==='payer-action'||item.rel==='approve');
  const host=api.mode==='live'?'www.paypal.com':'www.sandbox.paypal.com';
  const approval=link?new URL(link.href):null;
  if(!order.id||!approval||approval.origin!=='https://'+host)throw new ApiError(502,'PayPal did not return a checkout link.');
  service.db.prepare(`UPDATE listing_payments SET paypal_order_id=?,approval_url=?
    WHERE listing_id=? AND paypal_order_id IS NULL`).run(order.id,approval.href,id);
  return {approvalUrl:payment(service,id)!.approval_url!};
}

function applyCapture(service:Marketplace,checkout:Checkout,order:Order,merchant:string,origin:string){
  const unit=order.purchase_units?.[0];
  const capture=unit?.payments?.captures?.[0];
  if(order.id!==checkout.paypal_order_id||order.status!=='COMPLETED'||
    order.purchase_units?.length!==1||unit?.reference_id!==checkout.listing_id||
    unit.payee?.merchant_id!==merchant||unit.payments?.captures?.length!==1||
    !capture?.id||capture.status!=='COMPLETED'||capture.amount.currency_code!=='GBP'||
    capture.amount.value!==amount(checkout.amount_pence)){
    throw new ApiError(409,'PayPal has not confirmed the expected payment.');
  }
  service.db.exec('BEGIN IMMEDIATE');
  try{
    const current=payment(service,checkout.listing_id);
    if(current?.capture_id!==capture.id){
      const listing=service.db.prepare('SELECT data,package_id FROM listings WHERE id=?')
        .get(checkout.listing_id) as {data:string;package_id:string}|undefined;
      const pack=listingPackages.find(item=>item.id===listing?.package_id);
      if(!listing||!pack||current?.capture_id)throw new ApiError(409,'This payment needs reconciliation.');
      const now=Date.now();
      const update=service.db.prepare(`UPDATE listings SET state='published',expires_at=?,updated_at=?
        WHERE id=? AND state='awaiting_payment' AND fee_pence=?`)
        .run(now+pack.durationDays*86400000,now,checkout.listing_id,checkout.amount_pence);
      if(update.changes!==1)throw new ApiError(409,'This payment needs reconciliation.');
      service.db.prepare('UPDATE listing_payments SET capture_id=? WHERE listing_id=?')
        .run(capture.id,checkout.listing_id);
      const machine=JSON.parse(listing.data) as Machine;
      const name=(machine.make+' '+machine.model).replace(/\s+/g,' ');
      const url=new URL('/equipment/'+encodeURIComponent(checkout.listing_id),origin).href;
      service.db.prepare('INSERT INTO listing_publication_emails(listing_id,subject,body) VALUES(?,?,?)')
        .run(checkout.listing_id,'New listing live: '+name,`A new listing is live on Buy & Sell Lasers.\n\n${name} (${machine.year})\n${url}`);
    }
    service.db.exec('COMMIT');
  }catch(error){
    service.db.exec('ROLLBACK');
    throw error;
  }
}

async function captureOrder(service:Marketplace,checkout:Checkout,api:Awaited<ReturnType<typeof client>>){
  if(checkout.capture_id)return;
  const path=orderPath(checkout.paypal_order_id!);
  let order=await api.call<Order>(path);
  if(order.status!=='COMPLETED'){
    const unit=order.purchase_units?.[0];
    if(order.status!=='APPROVED'||order.id!==checkout.paypal_order_id||
      order.purchase_units?.length!==1||unit?.reference_id!==checkout.listing_id||
      unit.payee?.merchant_id!==api.merchant||unit.amount?.currency_code!=='GBP'||
      unit.amount.value!==amount(checkout.amount_pence)){
      throw new ApiError(409,'PayPal has not approved the expected order.');
    }
    await api.call(path+'/capture',{},'capture-'+checkout.request_id);
    order=await api.call<Order>(path);
  }
  applyCapture(service,checkout,order,api.merchant,api.origin);
}

export async function captureCheckout(service:Marketplace,user:User,id:string,orderId:unknown){
  service.owned(user,id);
  const checkout=payment(service,id);
  if(!checkout?.paypal_order_id||checkout.paypal_order_id!==orderId)throw new ApiError(404,'PayPal order not found.');
  if(!checkout.capture_id)await captureOrder(service,checkout,await client());
  return checkout.listing_id;
}

export async function paypalWebhook(service:Marketplace,headers:Headers,event:Record<string,unknown>){
  const approved=event.event_type==='CHECKOUT.ORDER.APPROVED';
  if(!approved&&event.event_type!=='PAYMENT.CAPTURE.COMPLETED')return;
  const resource=event.resource as {id?:string;supplementary_data?:{related_ids?:{order_id?:string}}}|undefined;
  const orderId=approved?resource?.id:resource?.supplementary_data?.related_ids?.order_id;
  if(typeof orderId!=='string')return;
  const checkout=service.db.prepare('SELECT * FROM listing_payments WHERE paypal_order_id=?').get(orderId) as Checkout|undefined;
  if(!checkout)return;
  const signature:Record<string,string>={};
  for(const key of ['auth_algo','cert_url','transmission_id','transmission_sig','transmission_time']){
    const value=headers.get('paypal-'+key.replaceAll('_','-'));
    if(!value)throw new ApiError(400,'Missing PayPal signature.');
    signature[key]=value;
  }
  const api=await client();
  const verification=await api.call<{verification_status:string}>('/v1/notifications/verify-webhook-signature',{
    ...signature,webhook_id:api.webhook,webhook_event:event
  });
  if(verification.verification_status!=='SUCCESS')throw new ApiError(400,'Invalid PayPal signature.');
  if(approved){
    await captureOrder(service,checkout,api);
  }else if(!checkout.capture_id){
    applyCapture(service,checkout,await api.call<Order>(orderPath(orderId)),api.merchant,api.origin);
  }
  return checkout.listing_id;
}
