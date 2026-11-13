import {createHash,scryptSync,timingSafeEqual} from 'node:crypto';
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

export async function requirePortalPin(service:Marketplace,user:User,token:string){
  await service.requireOperator(user);
  const {version}=config();
  const access=await service.db.get<{failures:number;unlocked:number}>(`SELECT failures,EXISTS(
    SELECT 1 FROM portal_pin_sessions WHERE session_hash=? AND pin_version=?
  ) AS unlocked FROM (SELECT COALESCE((SELECT failures FROM portal_pin_attempts WHERE user_id=?),0) AS failures)`,
  sha(token),version,user.id);
  if(access!.failures>=3)throw locked();
  if(!access!.unlocked)throw new ApiError(428,'Enter your portal PIN.');
}

export async function unlockPortal(service:Marketplace,user:User,token:string,pin:unknown){
  await service.requireOperator(user);
  const {salt,digest,version}=config();
  if(typeof pin!=='string'||!/^\d{6}$/.test(pin))throw new ApiError(400,'Enter a six-digit PIN.');
  const correct=timingSafeEqual(scryptSync(pin,salt,64),Buffer.from(digest,'hex'));
  const remaining=await service.db.write(async db=>{
    const row=await db.get<{failures:number}>('SELECT failures FROM portal_pin_attempts WHERE user_id=?',user.id);
    const failures=row?.failures??0;
    if(failures>=3)return 0;
    if(!correct){
      await db.run(`INSERT INTO portal_pin_attempts VALUES(?,?)
        ON CONFLICT(user_id) DO UPDATE SET failures=excluded.failures`,user.id,failures+1);
      return 2-failures;
    }
    await db.run('DELETE FROM portal_pin_attempts WHERE user_id=?',user.id);
    await db.run(`INSERT INTO portal_pin_sessions VALUES(?,?)
      ON CONFLICT(session_hash) DO UPDATE SET pin_version=excluded.pin_version`,sha(token),version);
    return null;
  });
  if(remaining===0)throw locked();
  if(remaining!==null)throw new ApiError(403,`Incorrect PIN. ${remaining} ${remaining===1?'attempt':'attempts'} left.`);
}
