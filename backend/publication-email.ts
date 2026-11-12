import {ApiError,type Marketplace} from './service.ts';

const recipients=['info@buyandselllasers.com','az@wiwy.com'];

export async function sendPublicationEmail(service:Marketplace,listingId:string){
  const row=service.db.prepare('SELECT subject,body,sent_at FROM listing_publication_emails WHERE listing_id=?')
    .get(listingId) as {subject:string;body:string;sent_at:number|null}|undefined;
  if(!row||row.sent_at!==null)return;
  const {RESEND_API_KEY:key,MARKETPLACE_EMAIL_FROM:from}=process.env;
  if(!key||!from)throw new ApiError(503,'Publication email is awaiting sender configuration.');

  const response=await fetch('https://api.resend.com/emails',{
    method:'POST',
    headers:{Authorization:'Bearer '+key,'Content-Type':'application/json',
      'Idempotency-Key':'marketplace-listing-published/'+listingId},
    body:JSON.stringify({from,to:recipients,subject:row.subject,text:row.body}),
    signal:AbortSignal.timeout(8000),
    cache:'no-store'
  });
  if(!response.ok)throw new ApiError(503,'Publication email remains queued.');
  const result=await response.json() as {id?:string};
  if(!result.id)throw new ApiError(503,'Publication email remains queued.');
  service.db.prepare('UPDATE listing_publication_emails SET sent_at=?,provider_id=? WHERE listing_id=? AND sent_at IS NULL')
    .run(Date.now(),result.id,listingId);
}

export async function retryPublicationEmails(service:Marketplace){
  const pending=service.db.prepare('SELECT listing_id FROM listing_publication_emails WHERE sent_at IS NULL ORDER BY rowid LIMIT 10')
    .all() as {listing_id:string}[];
  const result=await Promise.allSettled(pending.map(row=>sendPublicationEmail(service,row.listing_id)));
  return {sent:result.filter(item=>item.status==='fulfilled').length,pending:result.filter(item=>item.status==='rejected').length};
}
