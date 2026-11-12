import {randomUUID} from 'node:crypto';
import type {Queries} from './store.ts';
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

function payment(db:Queries,id:string){
  return db.get<Checkout>('SELECT * FROM listing_payments WHERE listing_id=?',id);
}

export async function startCheckout(service:Marketplace,user:User,id:string){
  const row=await service.owned(user,id);
  if(row.state!=='awaiting_payment'||!row.fee_pence)throw new ApiError(409,'Submit the listing before starting checkout.');
  const api=await client();
  await service.db.run(`INSERT INTO listing_payments(listing_id,request_id,amount_pence)
    SELECT id,?,fee_pence FROM listings WHERE id=? AND state='awaiting_payment' AND fee_pence=?
    ON CONFLICT(listing_id) DO NOTHING`,randomUUID(),id,row.fee_pence);
  let checkout=await payment(service.db,id);
  if(!checkout||checkout.capture_id)throw new ApiError(409,'Checkout is no longer available.');
  if(checkout.paypal_order_id){
    const existing=await api.call<Order>(orderPath(checkout.paypal_order_id));
    if(existing.id!==checkout.paypal_order_id)throw new ApiError(409,'This payment needs reconciliation.');
    if(existing.status==='COMPLETED'||existing.status==='APPROVED'){
      await captureOrder(service,checkout,api);
      return {published:Boolean(await service.publishedListing(id))};
    }
    if(existing.status!=='VOIDED')return {approvalUrl:checkout.approval_url};
    await service.db.run(`UPDATE listing_payments SET request_id=?,paypal_order_id=NULL,approval_url=NULL
      WHERE listing_id=? AND paypal_order_id=? AND capture_id IS NULL`,randomUUID(),id,existing.id);
    checkout=await payment(service.db,id);
    if(!checkout||checkout.capture_id)throw new ApiError(409,'This payment needs reconciliation.');
    if(checkout.approval_url)return {approvalUrl:checkout.approval_url};
  }

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
  await service.db.run(`UPDATE listing_payments SET paypal_order_id=?,approval_url=?
    WHERE listing_id=? AND request_id=? AND paypal_order_id IS NULL`,order.id,approval.href,id,checkout.request_id);
  const saved=await payment(service.db,id);
  if(!saved?.approval_url)throw new ApiError(409,'Checkout changed. Please try again.');
  return {approvalUrl:saved.approval_url};
}

async function applyCapture(service:Marketplace,checkout:Checkout,order:Order,merchant:string,origin:string){
  const unit=order.purchase_units?.[0];
  const capture=unit?.payments?.captures?.[0];
  if(order.id!==checkout.paypal_order_id||order.status!=='COMPLETED'||
    order.purchase_units?.length!==1||unit?.reference_id!==checkout.listing_id||
    unit.payee?.merchant_id!==merchant||unit.payments?.captures?.length!==1||
    !capture?.id||capture.status!=='COMPLETED'||capture.amount.currency_code!=='GBP'||
    capture.amount.value!==amount(checkout.amount_pence)){
    throw new ApiError(409,'PayPal has not confirmed the expected payment.');
  }
  await service.db.write(async db=>{
    const current=await payment(db,checkout.listing_id);
    if(current?.capture_id!==capture.id){
      const listing=await db.get<{data:string;package_id:string}>('SELECT data,package_id FROM listings WHERE id=?',checkout.listing_id);
      const pack=listingPackages.find(item=>item.id===listing?.package_id);
      if(!listing||!pack||current?.capture_id||current?.paypal_order_id!==checkout.paypal_order_id)throw new ApiError(409,'This payment needs reconciliation.');
      const now=Date.now();
      const held=await db.get('SELECT 1 FROM listing_payment_incidents WHERE capture_id=?',capture.id);
      const updated=await db.run(`UPDATE listings SET state=?,expires_at=?,updated_at=?
        WHERE id=? AND state='awaiting_payment' AND fee_pence=?`,held?'withdrawn':'published',held?null:now+pack.durationDays*86400000,now,checkout.listing_id,checkout.amount_pence);
      if(updated!==1)throw new ApiError(409,'This payment needs reconciliation.');
      await db.run('UPDATE listing_payments SET capture_id=? WHERE listing_id=?',capture.id,checkout.listing_id);
      if(held)return;
      const machine=JSON.parse(listing.data) as Machine;
      const name=(machine.make+' '+machine.model).replace(/\s+/g,' ');
      const url=new URL('/equipment/'+encodeURIComponent(checkout.listing_id),origin).href;
      await db.run('INSERT INTO listing_publication_emails(listing_id,subject,body) VALUES(?,?,?)',checkout.listing_id,'New listing live: '+name,`A new listing is live on Buy & Sell Lasers.\n\n${name} (${machine.year})\n${url}`);
    }
  });
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
  await applyCapture(service,checkout,order,api.merchant,api.origin);
}

export async function captureCheckout(service:Marketplace,user:User,id:string,orderId:unknown){
  await service.owned(user,id);
  const checkout=await payment(service.db,id);
  if(!checkout?.paypal_order_id||checkout.paypal_order_id!==orderId)throw new ApiError(404,'PayPal order not found.');
  if(!checkout.capture_id)await captureOrder(service,checkout,await client());
  return checkout.listing_id;
}

const adverseEvents=new Set(['PAYMENT.CAPTURE.REFUNDED','PAYMENT.CAPTURE.REVERSED','CUSTOMER.DISPUTE.CREATED']);

type WebhookResource={
  id?:string;
  links?:{rel?:string;href?:string}[];
  supplementary_data?:{related_ids?:{order_id?:string;capture_id?:string}};
  disputed_transactions?:{seller_transaction_id?:string}[];
};

function incidentCaptures(event:string,resource:WebhookResource|undefined){
  const ids=event==='CUSTOMER.DISPUTE.CREATED'
    ? resource?.disputed_transactions?.map(transaction=>transaction.seller_transaction_id)??[]
    : [resource?.supplementary_data?.related_ids?.capture_id,
      ...(event==='PAYMENT.CAPTURE.REVERSED'?[resource?.id]:[]),
      ...(resource?.links??[]).filter(link=>link.rel==='up').map(link=>{
        if(typeof link.href!=='string')return;
        return /\/v2\/payments\/captures\/([A-Z0-9]+)$/i.exec(link.href)?.[1];
      })];
  return [...new Set(ids.filter((id):id is string=>typeof id==='string'&&/^[A-Z0-9]{1,50}$/i.test(id)))];
}

async function holdAffectedListings(service:Marketplace,eventId:string,eventType:string,captureIds:string[]){
  await service.db.write(async db=>{
    const now=Date.now();
    for(const captureId of captureIds){
      await db.run(`INSERT INTO listing_payment_incidents VALUES(?,?,?,?) ON CONFLICT(event_id,capture_id) DO NOTHING`,
        eventId,captureId,eventType,now);
      await db.run(`UPDATE listings SET state='withdrawn',updated_at=? WHERE state='published'
        AND id=(SELECT listing_id FROM listing_payments WHERE capture_id=?)`,now,captureId);
    }
  });
}

export async function paypalWebhook(service:Marketplace,headers:Headers,event:Record<string,unknown>){
  const eventType=event.event_type;
  if(typeof eventType!=='string')return;
  const approved=eventType==='CHECKOUT.ORDER.APPROVED';
  const adverse=adverseEvents.has(eventType);
  if(!approved&&!adverse&&eventType!=='PAYMENT.CAPTURE.COMPLETED')return;
  const resource=event.resource as WebhookResource|undefined;
  const orderId=approved?resource?.id:resource?.supplementary_data?.related_ids?.order_id;
  const checkout=typeof orderId==='string'
    ? await service.db.get<Checkout>('SELECT * FROM listing_payments WHERE paypal_order_id=?',orderId)
    : undefined;
  const captures=adverse?incidentCaptures(eventType,resource):[];
  if(adverse?(!captures.length||typeof event.id!=='string'):!checkout)return;
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
  if(adverse){
    await holdAffectedListings(service,event.id as string,eventType,captures);
    return;
  }
  if(!checkout||typeof orderId!=='string')return;
  if(approved){
    await captureOrder(service,checkout,api);
  }else if(!checkout.capture_id){
    await applyCapture(service,checkout,await api.call<Order>(orderPath(orderId)),api.merchant,api.origin);
  }
  return checkout.listing_id;
}
