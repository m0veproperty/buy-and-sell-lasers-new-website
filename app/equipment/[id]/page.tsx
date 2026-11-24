import {notFound} from 'next/navigation';
import {Marketplace} from '@/backend/service';
import {getStore} from '@/backend/store';
import SiteShell from '@/components/SiteShell';
import ListingDetail from '@/components/ListingDetail';
import {sellerCategoryNames} from '@/lib/equipment-taxonomy';

export const dynamic='force-dynamic';

export default async function EquipmentPage({params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const store=await getStore().catch(error=>{
    if(error instanceof Error&&error.message==='HOSTED_STORAGE_REQUIRED')notFound();
    throw error;
  });
  const listing=await new Marketplace(store).publishedListing(id);
  if(!listing)notFound();
  const {data,photos}=listing;
  return <SiteShell>
    <ListingDetail item={{id,brand:data.make,model:data.model,year:data.year,category:sellerCategoryNames[data.category]??'Other equipment',price:Number(data.askingPrice),location:data.location,photos:photos.map(photo=>'/api/marketplace/photos/'+photo),description:data.description||`${data.make} ${data.model} offered by a marketplace seller.`,conditionGrade:data.conditionGrade||'Not stated',conditionNotes:data.condition,history:data.history||'Service and ownership history has not been provided.',accessories:data.accessories||'Ask the seller to confirm the included accessories.',nativeId:id}}/>
  </SiteShell>;
}
