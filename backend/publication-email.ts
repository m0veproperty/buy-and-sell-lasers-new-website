import {createHash} from 'node:crypto';
import {ApiError,type Marketplace} from './service.ts';

type Notification={listing_id:string;kind:'approval_request'|'listing_live';recipient:string;subject:string;body:string;sent_at:number|null};

export async function sendListingNotifications(service:Marketplace,listingId:string){
  const rows=await service.db.all<Notification>(`SELECT n.listing_id,n.kind,n.recipient,n.subject,n.body,n.sent_at
    FROM listing_notifications n JOIN listings l ON l.id=n.listing_id
    WHERE n.listing_id=? AND n.sent_at IS NULL
      AND ((n.kind='approval_request' AND l.state='pending_review')
        OR (n.kind='listing_live' AND l.state='published' AND l.expires_at>?))
    ORDER BY CASE n.kind WHEN 'approval_request' THEN 0 ELSE 1 END,n.recipient`,listingId,Date.now());
  if(!rows.length)return;
  const {RESEND_API_KEY:key,MARKETPLACE_EMAIL_FROM:from}=process.env;
  if(!key||!from)throw new ApiError(503,'Listing email is awaiting sender configuration.');
  for(const row of rows){
    const response=await fetch('https://api.resend.com/emails',{
      method:'POST',
      headers:{Authorization:'Bearer '+key,'Content-Type':'application/json',
        'Idempotency-Key':'marketplace/'+row.kind+'/'+row.listing_id+'/'+createHash('sha256').update(row.recipient).digest('hex').slice(0,16)},
      body:JSON.stringify({from,to:[row.recipient],subject:row.subject,text:row.body}),
      signal:AbortSignal.timeout(8000),
      cache:'no-store'
    });
    if(!response.ok)throw new ApiError(503,'Listing email remains queued.');
    const result=await response.json() as {id?:string};
    if(!result.id)throw new ApiError(503,'Listing email remains queued.');
    await service.db.run(`UPDATE listing_notifications SET sent_at=?,provider_id=?
      WHERE listing_id=? AND kind=? AND recipient=? AND sent_at IS NULL`,
      Date.now(),result.id,row.listing_id,row.kind,row.recipient);
  }
}

export async function retryListingNotifications(service:Marketplace){
  const pending=await service.db.all<{listing_id:string}>(`SELECT DISTINCT n.listing_id
    FROM listing_notifications n JOIN listings l ON l.id=n.listing_id
    WHERE n.sent_at IS NULL AND ((n.kind='approval_request' AND l.state='pending_review')
      OR (n.kind='listing_live' AND l.state='published' AND l.expires_at>?))
    LIMIT 10`,Date.now());
  const result=await Promise.allSettled(pending.map(row=>sendListingNotifications(service,row.listing_id)));
  return {sent:result.filter(item=>item.status==='fulfilled').length,pending:result.filter(item=>item.status==='rejected').length};
}
