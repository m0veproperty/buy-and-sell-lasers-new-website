import {randomBytes,randomUUID,createHash,scrypt as scryptCallback,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import type {Queries,Store} from './store.ts';
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
  readonly db:Store;
  constructor(db:Store){this.db=db;}

  async rate(key:string,limit:number,windowMs=900000){
    const now=Date.now();
    await this.db.run('DELETE FROM rate_limits WHERE reset_at<=?',now);
    const row=await this.db.get<{hits:number}>(`INSERT INTO rate_limits(key,hits,reset_at) VALUES(?,1,?)
      ON CONFLICT(key) DO UPDATE SET hits=CASE WHEN reset_at<=? THEN 1 ELSE hits+1 END,
        reset_at=CASE WHEN reset_at<=? THEN excluded.reset_at ELSE reset_at END RETURNING hits`,
      hash(key),now+windowMs,now,now);
    if(!row||row.hits>limit)throw new ApiError(429,'Too many attempts. Please try again later.');
  }

  async register(input:Record<string,unknown>){
    const address=email(input.email),name=text(input.name,'Name',120),password=text(input.password,'Password',128,12);
    const salt=randomBytes(16).toString('hex');
    const derived=await scrypt(password,salt,64) as Buffer;
    const id=randomUUID();
    return this.db.write(async db=>{
      const inserted=await db.run('INSERT INTO users VALUES(?,?,?,?,?) ON CONFLICT(email) DO NOTHING',
        id,address,name,salt+':'+derived.toString('hex'),Date.now());
      if(!inserted)throw new ApiError(409,'Unable to create this account. Try signing in.');
      return {user:{id,email:address,name},token:await this.newSession(id,db)};
    });
  }

  async login(input:Record<string,unknown>){
    const address=email(input.email),password=text(input.password,'Password',128);
    const row=await this.db.get<User&{password_hash:string}>('SELECT * FROM users WHERE email=?',address);
    const [salt,expected]=(row?.password_hash??'0'.repeat(32)+':'+ '00'.repeat(64)).split(':');
    const derived=await scrypt(password,salt,64) as Buffer;
    if(!timingSafeEqual(derived,Buffer.from(expected,'hex'))||!row)throw new ApiError(401,'Email or password is incorrect.');
    return {user:{id:row.id,email:row.email,name:row.name},token:await this.newSession(row.id)};
  }

  async newSession(id:string,db:Queries=this.db){
    const token=randomBytes(32).toString('base64url');
    await db.run('DELETE FROM sessions WHERE expires_at<=?',Date.now());
    await db.run('INSERT INTO sessions VALUES(?,?,?)',hash(token),id,Date.now()+7*86400000);
    return token;
  }

  async user(token:string|undefined):Promise<User>{
    const row=token?await this.db.get<User>(`SELECT u.id,u.email,u.name FROM users u
      JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=? AND s.expires_at>?`,hash(token),Date.now()):undefined;
    if(!row)throw new ApiError(401,'Sign in to continue.');
    return row;
  }

  async logout(token:string|undefined){
    if(token)await this.db.run('DELETE FROM sessions WHERE token_hash=?',hash(token));
  }

  async requireOperator(user:User){
    if(!await this.db.get('SELECT 1 FROM listing_operators WHERE user_id=?',user.id)){
      throw new ApiError(403,'Operator access is required.');
    }
  }

  async listingsForOperators(user:User){
    await this.requireOperator(user);
    const rows=await this.db.all<Row&{seller_email:string;seller_name:string;similar:number;payment_incidents:string}>(`SELECT l.*,u.email AS seller_email,u.name AS seller_name,
      (SELECT json_group_array(DISTINCT event_type) FROM listing_payment_incidents i
        WHERE i.capture_id=p.capture_id) AS payment_incidents,
      EXISTS(SELECT 1 FROM listings other
        WHERE other.id<>l.id AND other.state='published' AND other.expires_at>?
        AND lower(json_extract(other.data,'$.make'))=lower(json_extract(l.data,'$.make'))
        AND lower(json_extract(other.data,'$.model'))=lower(json_extract(l.data,'$.model'))
        AND lower(json_extract(other.data,'$.location'))=lower(json_extract(l.data,'$.location'))) AS similar
      FROM listings l JOIN users u ON u.id=l.owner_id
      JOIN listing_payments p ON p.listing_id=l.id
      WHERE p.capture_id IS NOT NULL AND ((l.state='published' AND l.expires_at>?)
        OR (l.state='withdrawn' AND EXISTS(SELECT 1 FROM listing_payment_incidents i WHERE i.capture_id=p.capture_id)))
      ORDER BY l.updated_at DESC LIMIT 100`,Date.now(),Date.now());
    return Promise.all(rows.map(async row=>{
      const listing=await this.present(row);
      const flags:string[]=[];
      if(row.similar)flags.push('Another listing has the same make, model and location.');
      if(!listing.data.history)flags.push('The seller did not provide service or ownership history.');
      return {...listing,sellerEmail:row.seller_email,sellerName:row.seller_name,expiresAt:row.expires_at,flags,paymentIncidents:JSON.parse(row.payment_incidents) as string[]};
    }));
  }

  private async row(id:string,db:Queries=this.db){
    const row=await db.get<Row>('SELECT * FROM listings WHERE id=?',id);
    if(!row)throw new ApiError(404,'Listing not found.');
    return row;
  }

  async owned(user:User,id:string,db:Queries=this.db){
    const row=await this.row(id,db);
    if(row.owner_id!==user.id)throw new ApiError(404,'Listing not found.');
    return row;
  }

  private async present(row:Row,db:Queries=this.db){
    const photos=await db.all<{id:string}>('SELECT id FROM photos WHERE listing_id=? ORDER BY created_at,id',row.id);
    return {id:row.id,data:JSON.parse(row.data) as Machine,state:row.state,packageId:row.package_id,
      feePence:row.fee_pence,photos:photos.map(photo=>photo.id),updatedAt:row.updated_at};
  }

  async mine(user:User){
    const rows=await this.db.all<Row&{checkout_started:number}>(`SELECT l.*,
      EXISTS(SELECT 1 FROM listing_payments p WHERE p.listing_id=l.id) AS checkout_started
      FROM listings l WHERE l.owner_id=? ORDER BY l.updated_at DESC`,user.id);
    return Promise.all(rows.map(async row=>({...await this.present(row),checkoutStarted:Boolean(row.checkout_started)})));
  }

  async save(user:User,input:Record<string,unknown>,id?:string){
    const data=validateMachine(input),now=Date.now();
    return this.db.write(async db=>{
      const listingId=id??randomUUID();
      if(id){
        const row=await this.owned(user,id,db);
        if(row.state!=='draft')throw new ApiError(409,'Return this listing to draft before editing.');
        await db.run('UPDATE listings SET data=?,updated_at=? WHERE id=?',JSON.stringify(data),now,id);
      }else{
        await db.run('INSERT INTO listings(id,owner_id,data,created_at,updated_at) VALUES(?,?,?,?,?)',
          listingId,user.id,JSON.stringify(data),now,now);
      }
      return this.present(await this.row(listingId,db),db);
    });
  }

  async submit(user:User,id:string){
    return this.db.write(async db=>{
      const row=await this.owned(user,id,db);
      if(row.state==='awaiting_payment')return this.present(row,db);
      if(row.state!=='draft')throw new ApiError(409,'Only drafts can be submitted.');
      const data=validateMachine(JSON.parse(row.data));
      const pence=Math.round(Number(data.askingPrice)*100),pack=packageForPrice(pence),quote=quoteListingFee(pence,pack.id);
      const count=await this.photoCount(id,db);
      if(count<1)throw new ApiError(400,'Add at least one photograph before continuing.');
      if(pack.photoLimit!==null&&count>pack.photoLimit)throw new ApiError(400,`This package permits ${pack.photoLimit} photographs.`);
      await db.run("UPDATE listings SET state='awaiting_payment',package_id=?,fee_pence=?,updated_at=? WHERE id=?",
        pack.id,quote.amountPence,Date.now(),id);
      return this.present(await this.row(id,db),db);
    });
  }

  async returnToDraft(user:User,id:string){
    return this.db.write(async db=>{
      const row=await this.owned(user,id,db);
      if(await db.get('SELECT 1 FROM listing_payments WHERE listing_id=?',id)){
        throw new ApiError(409,'Checkout has started for this listing.');
      }
      if(!['draft','awaiting_payment'].includes(row.state))throw new ApiError(409,'This listing cannot be returned to draft.');
      await db.run("UPDATE listings SET state='draft',package_id=NULL,fee_pence=NULL,updated_at=? WHERE id=?",Date.now(),id);
      return this.present(await this.row(id,db),db);
    });
  }

  private async photoCount(id:string,db:Queries){
    const row=await db.get<{count:number}>('SELECT count(*) AS count FROM photos WHERE listing_id=?',id);
    return row?.count??0;
  }

  async addPhoto(user:User,id:string,bytes:Uint8Array){
    return this.db.write(async db=>{
      const row=await this.owned(user,id,db);
      if(row.state!=='draft')throw new ApiError(409,'Only draft photographs can be changed.');
      const pack=packageForPrice(Math.round(Number(JSON.parse(row.data).askingPrice)*100));
      if(pack.photoLimit!==null&&await this.photoCount(id,db)>=pack.photoLimit)throw new ApiError(400,'Photograph limit reached.');
      const photoId=randomUUID();
      await db.run('INSERT INTO photos VALUES(?,?,?,?)',photoId,id,bytes,Date.now());
      return photoId;
    });
  }

  async removePhoto(user:User,id:string,photoId:string){
    return this.db.write(async db=>{
      if((await this.owned(user,id,db)).state!=='draft')throw new ApiError(409,'Only draft photographs can be changed.');
      await db.run('DELETE FROM photos WHERE id=? AND listing_id=?',photoId,id);
    });
  }

  async photo(photoId:string,user?:User){
    const p=await this.db.get<{bytes:ArrayBuffer}>(`SELECT p.bytes FROM photos p JOIN listings l ON l.id=p.listing_id
      WHERE p.id=? AND (l.owner_id=? OR (l.state='published' AND l.expires_at>?)
      OR (l.state='withdrawn' AND EXISTS(SELECT 1 FROM listing_operators WHERE user_id=?)
        AND EXISTS(SELECT 1 FROM listing_payments lp JOIN listing_payment_incidents i
          ON i.capture_id=lp.capture_id WHERE lp.listing_id=l.id)))`,photoId,user?.id??null,Date.now(),user?.id??null);
    if(!p)throw new ApiError(404,'Photograph not found.');
    return new Uint8Array(p.bytes);
  }

  async publishedListing(id:string){
    const row=await this.db.get<Row>("SELECT * FROM listings WHERE id=? AND state='published' AND expires_at>?",id,Date.now());
    return row?this.present(row):undefined;
  }

  async published(){
    const rows=await this.db.all<Row>("SELECT * FROM listings WHERE state='published' AND expires_at>? ORDER BY created_at DESC",Date.now());
    return Promise.all(rows.map(row=>this.present(row)));
  }

  async enquire(id:string,input:Record<string,unknown>){
    const name=text(input.name,'Name',120),address=email(input.email),message=text(input.message,'Message',5000);
    const enquiryId=randomUUID(),now=Date.now();
    const inserted=await this.db.run(`INSERT INTO enquiries
      SELECT ?,id,?,?,?,? FROM listings WHERE id=? AND state='published' AND expires_at>?`,
      enquiryId,name,address,message,now,id,now);
    if(!inserted)throw new ApiError(404,'This listing is not accepting enquiries.');
    return {id:enquiryId};
  }

  async inbox(user:User){
    const rows=await this.db.all<{data:string}>(`SELECT e.*,l.data FROM enquiries e
      JOIN listings l ON l.id=e.listing_id WHERE l.owner_id=? ORDER BY e.created_at DESC`,user.id);
    return rows.map(row=>({...row,data:JSON.parse(row.data) as Machine}));
  }

  async contact(input:Record<string,unknown>){
    const id=randomUUID();
    await this.db.run('INSERT INTO contact_messages VALUES(?,?,?,?,?,?)',id,text(input.name,'Name',120),
      email(input.email),text(input.topic,'Topic',120),text(input.message,'Message',5000),Date.now());
    return {id};
  }
}
