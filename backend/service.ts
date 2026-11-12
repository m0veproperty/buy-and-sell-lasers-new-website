import {randomBytes,randomUUID,createHash,scrypt as scryptCallback,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import type {DatabaseSync} from 'node:sqlite';
import {packageForPrice,quoteListingFee} from '../lib/listing-packages.ts';

const scrypt=promisify(scryptCallback);
export class ApiError extends Error { status:number; constructor(status:number,message:string){super(message);this.status=status;} }
export type User={id:string;email:string;name:string};
export type Machine={make:string;model:string;year:string;askingPrice:string;location:string;category:string;condition:string;accessories:string;history:string};
type Row={id:string;owner_id:string;data:string;state:string;package_id:string|null;fee_pence:number|null;expires_at:number|null;created_at:number;updated_at:number};
export const machineCategories=['Laser hair removal','Laser tattoo removal','IPL machines','All-in-one machines','Skin treatment','Slimming machines'];
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
export function text(value:unknown,label:string,max=2000,min=1) {
  if(typeof value!=='string'||value.trim().length<min||value.trim().length>max) throw new ApiError(400,`${label} must be ${min}–${max} characters.`);
  return value.trim();
}
export function email(value:unknown) {const s=text(value,'Email',254).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s))throw new ApiError(400,'Enter a valid email address.');return s;}
export function validateMachine(input:Record<string,unknown>):Machine {
  const result={} as Machine;
  for(const k of ['make','model','year','askingPrice','location','category','condition','accessories','history'] as const)result[k]=text(input[k]??'',k,k==='condition'||k==='history'||k==='accessories'?2000:120,['accessories','history'].includes(k)?0:1);
  if(!machineCategories.includes(result.category))throw new ApiError(400,'Choose an equipment category.');
  if(!/^\d{4}$/.test(result.year)||Number(result.year)<1900||Number(result.year)>new Date().getFullYear())throw new ApiError(400,'Enter a valid model year.');
  if(!/^\d{1,8}(\.\d{1,2})?$/.test(result.askingPrice)||Number(result.askingPrice)<=0)throw new ApiError(400,'Enter a positive price with at most two decimal places.');
  return result;
}

export class Marketplace {
  readonly db:DatabaseSync;
  constructor(db:DatabaseSync){this.db=db;}
  rate(key:string,limit:number,windowMs=900000) {
    const now=Date.now();
    this.db.prepare('DELETE FROM rate_limits WHERE reset_at<=?').run(now);
    const row=this.db.prepare(`INSERT INTO rate_limits(key,hits,reset_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET hits=hits+1 RETURNING hits`).get(hash(key),now+windowMs) as {hits:number};
    if(row.hits>limit)throw new ApiError(429,'Too many attempts. Please try again later.');
  }
  async register(input:Record<string,unknown>) {
    const address=email(input.email),name=text(input.name,'Name',120),password=text(input.password,'Password',128,12);
    const salt=randomBytes(16).toString('hex');const derived=await scrypt(password,salt,64) as Buffer;
    const id=randomUUID();
    try{this.db.prepare('INSERT INTO users VALUES(?,?,?,?,?)').run(id,address,name,salt+':'+derived.toString('hex'),Date.now());}
    catch(error){if(this.db.prepare('SELECT id FROM users WHERE email=?').get(address))throw new ApiError(409,'Unable to create this account. Try signing in.');throw error;}
    return {user:{id,email:address,name},token:this.newSession(id)};
  }
  async login(input:Record<string,unknown>) {
    const address=email(input.email),password=text(input.password,'Password',128);
    const row=this.db.prepare('SELECT * FROM users WHERE email=?').get(address) as (User&{password_hash:string})|undefined;
    const [salt,expected]=(row?.password_hash??'00000000000000000000000000000000:'+ '00'.repeat(64)).split(':');
    const derived=await scrypt(password,salt,64) as Buffer;
    if(!timingSafeEqual(derived,Buffer.from(expected,'hex'))||!row)throw new ApiError(401,'Email or password is incorrect.');
    return {user:{id:row.id,email:row.email,name:row.name},token:this.newSession(row.id)};
  }
  newSession(id:string){const token=randomBytes(32).toString('base64url');this.db.prepare('DELETE FROM sessions WHERE expires_at<=?').run(Date.now());this.db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(hash(token),id,Date.now()+7*86400000);return token;}
  user(token:string|undefined):User {
    const row=token?this.db.prepare('SELECT u.id,u.email,u.name FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=? AND s.expires_at>?').get(hash(token),Date.now()) as User|undefined:undefined;
    if(!row)throw new ApiError(401,'Sign in to continue.');return row;
  }
  logout(token:string|undefined){if(token)this.db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hash(token));}
  isOperator(user:User){return Boolean(this.db.prepare('SELECT 1 FROM listing_operators WHERE user_id=?').get(user.id));}
  private requireOperator(user:User){
    if(!this.isOperator(user))throw new ApiError(403,'Operator access is required.');
  }
  publishedForOperators(user:User){
    this.requireOperator(user);
    const rows=this.db.prepare(`SELECT l.*,u.email AS seller_email,
      EXISTS(SELECT 1 FROM listings other
        WHERE other.id<>l.id AND other.state='published' AND other.expires_at>l.updated_at
        AND lower(json_extract(other.data,'$.make'))=lower(json_extract(l.data,'$.make'))
        AND lower(json_extract(other.data,'$.model'))=lower(json_extract(l.data,'$.model'))
        AND lower(json_extract(other.data,'$.location'))=lower(json_extract(l.data,'$.location'))) AS similar
      FROM listings l JOIN users u ON u.id=l.owner_id
      JOIN listing_payments p ON p.listing_id=l.id
      WHERE l.state='published' AND l.expires_at>? AND p.capture_id IS NOT NULL
      ORDER BY l.updated_at DESC LIMIT 100`).all(Date.now()) as (Row&{seller_email:string;similar:number})[];
    return rows.map(row=>{
      const listing=this.present(row);
      const flags:string[]=[];
      if(row.similar)flags.push('Another listing has the same make, model and location.');
      if(!listing.data.history)flags.push('The seller did not provide service or ownership history.');
      return {...listing,sellerEmail:row.seller_email,flags};
    });
  }
  private row(id:string){const row=this.db.prepare('SELECT * FROM listings WHERE id=?').get(id) as Row|undefined;if(!row)throw new ApiError(404,'Listing not found.');return row;}
  owned(user:User,id:string){const row=this.row(id);if(row.owner_id!==user.id)throw new ApiError(404,'Listing not found.');return row;}
  private present(row:Row){return {id:row.id,data:JSON.parse(row.data) as Machine,state:row.state,packageId:row.package_id,feePence:row.fee_pence,photos:this.db.prepare('SELECT id FROM photos WHERE listing_id=? ORDER BY created_at').all(row.id).map(p=>String(p.id)),updatedAt:row.updated_at};}
  mine(user:User){return (this.db.prepare('SELECT * FROM listings WHERE owner_id=? ORDER BY updated_at DESC').all(user.id) as Row[]).map(r=>({...this.present(r),checkoutStarted:Boolean(this.db.prepare('SELECT 1 FROM listing_payments WHERE listing_id=?').get(r.id))}));}
  save(user:User,input:Record<string,unknown>,id?:string){
    const data=validateMachine(input),now=Date.now();
    if(id){const row=this.owned(user,id);if(row.state!=='draft')throw new ApiError(409,'Return this listing to draft before editing.');this.db.prepare('UPDATE listings SET data=?,updated_at=? WHERE id=?').run(JSON.stringify(data),now,id);}
    else{id=randomUUID();this.db.prepare('INSERT INTO listings(id,owner_id,data,created_at,updated_at) VALUES(?,?,?,?,?)').run(id,user.id,JSON.stringify(data),now,now);}
    return this.present(this.row(id));
  }
  submit(user:User,id:string){
    const row=this.owned(user,id);if(row.state==='awaiting_payment')return this.present(row);
    if(row.state!=='draft')throw new ApiError(409,'Only drafts can be submitted.');
    const data=validateMachine(JSON.parse(row.data));const pence=Math.round(Number(data.askingPrice)*100),pack=packageForPrice(pence),quote=quoteListingFee(pence,pack.id);
    const count=this.db.prepare('SELECT count(*) AS n FROM photos WHERE listing_id=?').get(id) as {n:number};
    if(count.n<1)throw new ApiError(400,'Add at least one photograph before continuing.');
    if(pack.photoLimit!==null&&count.n>pack.photoLimit)throw new ApiError(400,`This package permits ${pack.photoLimit} photographs.`);
    this.db.prepare("UPDATE listings SET state='awaiting_payment',package_id=?,fee_pence=?,updated_at=? WHERE id=?").run(pack.id,quote.amountPence,Date.now(),id);
    return this.present(this.row(id));
  }
  returnToDraft(user:User,id:string){const row=this.owned(user,id);if(this.db.prepare('SELECT 1 FROM listing_payments WHERE listing_id=?').get(id))throw new ApiError(409,'Checkout has started for this listing.');if(!['draft','awaiting_payment'].includes(row.state))throw new ApiError(409,'This listing cannot be returned to draft.');this.db.prepare("UPDATE listings SET state='draft',package_id=NULL,fee_pence=NULL,updated_at=? WHERE id=?").run(Date.now(),id);return this.present(this.row(id));}
  addPhoto(user:User,id:string,bytes:Uint8Array){const row=this.owned(user,id);if(row.state!=='draft')throw new ApiError(409,'Only draft photographs can be changed.');const pack=packageForPrice(Math.round(Number(JSON.parse(row.data).askingPrice)*100));const n=this.db.prepare('SELECT count(*) AS n FROM photos WHERE listing_id=?').get(id) as {n:number};if(pack.photoLimit!==null&&n.n>=pack.photoLimit)throw new ApiError(400,'Photograph limit reached.');const photoId=randomUUID();this.db.prepare('INSERT INTO photos VALUES(?,?,?,?)').run(photoId,id,bytes,Date.now());return photoId;}
  removePhoto(user:User,id:string,photoId:string){if(this.owned(user,id).state!=='draft')throw new ApiError(409,'Only draft photographs can be changed.');this.db.prepare('DELETE FROM photos WHERE id=? AND listing_id=?').run(photoId,id);}
  photo(photoId:string,user?:User){const p=this.db.prepare('SELECT p.bytes,l.owner_id,l.state,l.expires_at FROM photos p JOIN listings l ON l.id=p.listing_id WHERE p.id=?').get(photoId) as {bytes:Uint8Array;owner_id:string;state:string;expires_at:number}|undefined;if(!p||(p.owner_id!==user?.id&&!(p.state==='published'&&p.expires_at>Date.now())))throw new ApiError(404,'Photograph not found.');return p.bytes;}
  publishedListing(id:string){
    const row=this.db.prepare("SELECT * FROM listings WHERE id=? AND state='published' AND expires_at>?")
      .get(id,Date.now()) as Row|undefined;
    return row?this.present(row):undefined;
  }
  published(){return (this.db.prepare("SELECT * FROM listings WHERE state='published' AND expires_at>? ORDER BY created_at DESC").all(Date.now()) as Row[]).map(r=>this.present(r));}
  enquire(id:string,input:Record<string,unknown>){const row=this.row(id);if(row.state!=='published'||!row.expires_at||row.expires_at<=Date.now())throw new ApiError(404,'This listing is not accepting enquiries.');const name=text(input.name,'Name',120),address=email(input.email),message=text(input.message,'Message',5000);const enquiryId=randomUUID();this.db.prepare('INSERT INTO enquiries VALUES(?,?,?,?,?,?)').run(enquiryId,id,name,address,message,Date.now());return {id:enquiryId};}
  inbox(user:User){return this.db.prepare('SELECT e.*,l.data FROM enquiries e JOIN listings l ON l.id=e.listing_id WHERE l.owner_id=? ORDER BY e.created_at DESC').all(user.id).map(r=>({...r,data:JSON.parse(String(r.data)) as Machine}));}
  contact(input:Record<string,unknown>){const id=randomUUID();this.db.prepare('INSERT INTO contact_messages VALUES(?,?,?,?,?,?)').run(id,text(input.name,'Name',120),email(input.email),text(input.topic,'Topic',120),text(input.message,'Message',5000),Date.now());return {id};}
}
