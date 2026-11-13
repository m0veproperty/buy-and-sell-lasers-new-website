import {createHash,randomBytes,scryptSync,timingSafeEqual} from 'node:crypto';
import {ApiError,type Marketplace,type User} from './service.ts';

function config(){
  const value=process.env.MARKETPLACE_PORTAL_PIN_HASH;
  if(!value||!(/^[a-f0-9]{32}:[a-f0-9]{128}$/i.test(value))){
    throw new ApiError(503,'Portal PIN has not been configured.');
  }
  const [salt,digest]=value.split(':');
  return {salt,digest,version:sha(value)};
}

function sha(value:string){return createHash('sha256').update(value).digest('hex');}
const locked=()=>new ApiError(423,'Portal locked after three incorrect attempts. Contact an administrator.');

export const portalSessionSeconds=3600;

export async function requirePortalPin(service:Marketplace,token:string|undefined):Promise<User>{
  const {version}=config();
  const row=await service.db.get<User&{failures:number}>(`SELECT u.id,u.email,u.name,
    COALESCE((SELECT failures FROM portal_access_attempts WHERE id=1),0) AS failures
    FROM users u JOIN listing_operators o ON o.user_id=u.id
    WHERE u.email=?`,process.env.MARKETPLACE_PORTAL_OPERATOR_EMAIL??'');
  if(!row)throw new ApiError(503,'Portal operator has not been configured.');
  if(row.failures>=3)throw locked();
  if(!token||!await service.db.get(`SELECT 1 FROM portal_access_sessions
    WHERE session_hash=? AND pin_version=? AND expires_at>?`,sha(token),version,Date.now())){
    throw new ApiError(428,'Enter your portal PIN.');
  }
  return {id:row.id,email:row.email,name:row.name};
}

export async function unlockPortal(service:Marketplace,pin:unknown){
  const {salt,digest,version}=config();
  const token=randomBytes(32).toString('base64url');
  const remaining=await service.db.write(async db=>{
    const actor=await db.get(`SELECT 1 FROM users u JOIN listing_operators o ON o.user_id=u.id
      WHERE u.email=?`,process.env.MARKETPLACE_PORTAL_OPERATOR_EMAIL??'');
    if(!actor)throw new ApiError(503,'Portal operator has not been configured.');
    const row=await db.get<{failures:number}>('SELECT failures FROM portal_access_attempts WHERE id=1');
    const failures=row?.failures??0;
    if(failures>=3)return 0;
    const correct=typeof pin==='string'&&/^\d{6}$/.test(pin)&&
      timingSafeEqual(scryptSync(pin,salt,64),Buffer.from(digest,'hex'));
    if(!correct){
      await db.run(`INSERT INTO portal_access_attempts VALUES(1,?)
        ON CONFLICT(id) DO UPDATE SET failures=excluded.failures`,failures+1);
      if(failures===2)await db.run('DELETE FROM portal_access_sessions');
      return 2-failures;
    }
    await db.run('DELETE FROM portal_access_attempts WHERE id=1');
    await db.run('DELETE FROM portal_access_sessions WHERE expires_at<=?',Date.now());
    await db.run('INSERT INTO portal_access_sessions VALUES(?,?,?)',sha(token),version,Date.now()+portalSessionSeconds*1000);
    return null;
  });
  if(remaining===0)throw locked();
  if(remaining!==null)throw new ApiError(403,`Incorrect PIN. ${remaining} ${remaining===1?'attempt':'attempts'} left.`);
  return token;
}

export async function lockPortal(service:Marketplace,token:string|undefined){
  if(token)await service.db.run('DELETE FROM portal_access_sessions WHERE session_hash=?',sha(token));
}
