import {notFound} from 'next/navigation';
import {Marketplace} from '@/backend/service';
import {getStore} from '@/backend/store';
import SiteShell,{PageIntro} from '@/components/SiteShell';
import EquipmentEnquiry from '@/components/EquipmentEnquiry';

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
    <PageIntro label={data.category} title={data.make+' '+data.model} description={data.year+' · '+data.location}/>
    <section className="account-page page-width">
      <p className="eyebrow">Asking price</p>
      <h2>{new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(Number(data.askingPrice))}</h2>
      <div className="account-photo-grid">{photos.map((photo,index)=><a key={photo} href={'/api/marketplace/photos/'+photo}>
        <img src={'/api/marketplace/photos/'+photo} alt={`Equipment photo ${index+1}`} width={360} height={260}/>
      </a>)}</div>
      <dl><dt>Condition</dt><dd>{data.condition}</dd>
        {data.accessories&&<><dt>Accessories</dt><dd>{data.accessories}</dd></>}
        {data.history&&<><dt>Service and ownership history</dt><dd>{data.history}</dd></>}
      </dl>
      <EquipmentEnquiry listingId={id}/>
    </section>
  </SiteShell>;
}
