import {NextRequest,NextResponse} from 'next/server';
import {timingSafeEqual} from 'node:crypto';
import {sendPublicationEmail,retryPublicationEmails} from '@/backend/publication-email';
import {labelWordPressMachine,wordpressInventory} from '@/backend/operator-inventory';
import {lockPortal,portalSessionSeconds,requirePortalPin,unlockPortal} from '@/backend/portal-pin';
import sharp from 'sharp';
import {getStore} from '@/backend/store';
import {startCheckout,captureCheckout,paypalWebhook} from '@/backend/paypal';
import {ApiError,Marketplace} from '@/backend/service';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const cookieName='laser_session';
const portalCookie='laser_portal';

async function bytes(request:Request,max:number) {
  if(Number(request.headers.get('content-length'))>max)throw new ApiError(413,'File or request is too large.');
  const reader=request.body?.getReader();if(!reader)return Buffer.alloc(0);
  let size=0;const parts:Uint8Array[]=[];
  try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();throw new ApiError(413,'File or request is too large.');}parts.push(value);}}finally{reader.releaseLock();}
  return Buffer.concat(parts);
}
async function json(request:Request){if(!request.headers.get('content-type')?.includes('application/json'))throw new ApiError(415,'JSON is required.');try{const data=JSON.parse((await bytes(request,24000)).toString());if(!data||Array.isArray(data)||typeof data!=='object')throw new Error();return data as Record<string,unknown>;}catch(e){if(e instanceof ApiError)throw e;throw new ApiError(400,'Invalid request body.');}}
function response(data:unknown,status=200){return NextResponse.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}

async function handle(req:NextRequest,ctx:{params:Promise<{path:string[]}>}){
  try{
    const path=(await ctx.params).path,method=req.method;
    const key=path.join('/');
    if(method==='POST'&&key==='paypal/webhook'){
      const service=new Marketplace(await getStore());
      const listingId=await paypalWebhook(service,req.headers,await json(req));
      if(listingId)await sendPublicationEmail(service,listingId);
      return response({ok:true});
    }
    if(method==='POST'&&key==='notifications/retry'){
      const secret=process.env.MARKETPLACE_NOTIFICATION_SECRET;
      const actual=Buffer.from(req.headers.get('authorization')??'');
      const expected=Buffer.from('Bearer '+secret);
      if(!secret||actual.length!==expected.length||!timingSafeEqual(actual,expected)){
        throw new ApiError(401,'Notification retry is not authorized.');
      }
      return response(await retryPublicationEmails(new Marketplace(await getStore())));
    }
    if(method!=='GET'){
      const requestOrigin=new URL(req.url);
      // Custom Next servers may normalize req.url to localhost; Host is the browser's destination.
      const host=req.headers.get('host');if(host)requestOrigin.host=host;
      const expected=process.env.APP_ORIGIN||requestOrigin.origin;
      if(req.headers.get('origin')!==expected)throw new ApiError(403,'Request origin is not allowed.');
    }
    const service=new Marketplace(await getStore()),token=req.cookies.get(cookieName)?.value;
    const portalToken=req.cookies.get(portalCookie)?.value;
    if(path[0]==='operator'){
      const options={httpOnly:true,sameSite:'strict' as const,secure:Boolean(process.env.VERCEL)||req.nextUrl.protocol==='https:',path:'/api/marketplace'};
      if(method==='POST'&&key==='operator/unlock'){
        const unlocked=await unlockPortal(service,(await json(req)).pin);
        const res=response({ok:true});
        res.cookies.set(portalCookie,unlocked,{...options,maxAge:portalSessionSeconds});
        return res;
      }
      if(method==='POST'&&key==='operator/lock'){
        await lockPortal(service,portalToken);
        const res=response({ok:true});
        res.cookies.set(portalCookie,'',{...options,maxAge:0});
        return res;
      }
      const actor=await requirePortalPin(service,portalToken);
      if(method==='GET'&&key==='operator/listings')return response({listings:await service.listingsForOperators(actor),wordpress:await wordpressInventory(service)});
      if(method==='PATCH'&&path.length===3&&path[1]==='wordpress'){
        await service.rate('portal-write:'+actor.id,100);
        return response(await labelWordPressMachine(service,actor,path[2],await json(req)));
      }
      throw new ApiError(404,'Endpoint not found.');
    }
    if(method==='POST'&&(key==='auth/register'||key==='auth/login')){
      await service.rate('auth-global',100);
      const data=await json(req);await service.rate('auth:'+String(data.email).trim().toLowerCase(),10);
      const result=key.endsWith('register')?await service.register(data):await service.login(data);
      const res=response({user:result.user},key.endsWith('register')?201:200);
      res.cookies.set(cookieName,result.token,{httpOnly:true,sameSite:'strict',secure:Boolean(process.env.VERCEL)||new URL(req.url).protocol==='https:',path:'/',maxAge:604800});return res;
    }
    if(method==='POST'&&key==='auth/logout'){await service.logout(token);const res=response({ok:true});res.cookies.set(cookieName,'',{maxAge:0,path:'/'});return res;}
    if(method==='GET'&&key==='listings')return response({listings:await service.published()});
    if(method==='GET'&&path[0]==='photos'&&path.length===2){let user;try{user=await service.user(token);}catch(e){if(!(e instanceof ApiError&&e.status===401))throw e;}let operatorAccess=false;
      if(portalToken){
        try{user=await requirePortalPin(service,portalToken);operatorAccess=true;}catch(e){if(!(e instanceof ApiError))throw e;}
      }
      const data=await service.photo(path[1],user,operatorAccess);return new NextResponse(new Uint8Array(data),{headers:{'Content-Type':'image/webp','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});}
    if(method==='POST'&&path[0]==='enquiries'&&path.length===2){await service.rate('enquiry-global',100);const data=await json(req);await service.rate('enquiry:'+String(data.email).toLowerCase(),5);return response(await service.enquire(path[1],data),201);}
    if(method==='POST'&&key==='contact'){await service.rate('contact-global',50);const data=await json(req);await service.rate('contact:'+String(data.email).toLowerCase(),5);return response(await service.contact(data),201);}
    const user=await service.user(token);
    if(method==='GET'&&key==='account')return response({user,listings:await service.mine(user),enquiries:await service.inbox(user)});
    if(method!=='GET')await service.rate('write:'+user.id,100);
    if(method==='POST'&&key==='listings')return response({listing:await service.save(user,await json(req))},201);
    if(path[0]==='listings'&&path.length>=2){
      const id=path[1];
      if(method==='POST'&&path[2]==='checkout'&&path.length===3){
        const checkout=await startCheckout(service,user,id);
        if(checkout.published)await sendPublicationEmail(service,id).catch(()=>{
          console.error('Publication email remains queued.');
        });
        return response(checkout);
      }
      if(method==='POST'&&path[2]==='capture'&&path.length===3){
        const listingId=await captureCheckout(service,user,id,(await json(req)).orderId);
        await sendPublicationEmail(service,listingId).catch(error=>{
          console.error('Publication email remains queued:',error instanceof Error?error.message:'Unknown error');
        });
        return response({ok:true});
      }
      if(method==='PATCH'&&path.length===2)return response({listing:await service.save(user,await json(req),id)});
      if(method==='POST'&&path[2]==='submit'&&path.length===3)return response({listing:await service.submit(user,id)});
      if(method==='POST'&&path[2]==='draft'&&path.length===3)return response({listing:await service.returnToDraft(user,id)});
      if(method==='POST'&&path[2]==='photos'&&path.length===3){
        await service.owned(user,id);const raw=await bytes(req,4*1024*1024);let converted:Buffer;
        try{const image=sharp(raw,{limitInputPixels:24000000,animated:false});const metadata=await image.metadata();if(!['jpeg','png','webp'].includes(metadata.format??''))throw new Error();converted=await image.rotate().resize({width:1800,height:1800,fit:'inside',withoutEnlargement:true}).webp({quality:85}).toBuffer();}catch{throw new ApiError(400,'Upload a JPEG, PNG or WebP photograph, up to 4 MB and 24 megapixels.');}
        return response({id:await service.addPhoto(user,id,converted)},201);
      }
      if(method==='DELETE'&&path[2]==='photos'&&path.length===4){await service.removePhoto(user,id,path[3]);return response({ok:true});}
    }
    throw new ApiError(404,'Endpoint not found.');
  }catch(error){if(error instanceof ApiError)return response({error:error.message},error.status);if(error instanceof Error&&error.message==='HOSTED_STORAGE_REQUIRED')return response({error:'Account services are not connected on this deployment yet.'},503);console.error('Marketplace request failed:',error instanceof Error?error.name:'Unknown error');return response({error:'Unable to complete this request. Please try again.'},500);}
}
export const GET=handle;
export const POST=handle;
export const PATCH=handle;
export const DELETE=handle;
