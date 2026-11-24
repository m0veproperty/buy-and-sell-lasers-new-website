import {Listing,origin} from '@/lib/listings';
import ListingDetail from './ListingDetail';

export default function ProductPage({listing}:{listing:Listing}){
  const photos=listing.id==='aw3'?['aw3-main','aw3-detail','aw3-record'].map(name=>`/images/${name}.webp`):[`/images/${listing.image}.webp`];
  return <ListingDetail item={{
    id:listing.id,brand:listing.brand,model:listing.name,year:listing.year,category:listing.category,
    price:listing.price,location:listing.location,photos,description:listing.description,
    conditionGrade:listing.conditionGrade??(listing.id==='aw3'?'Used':'Not stated'),
    conditionNotes:listing.id==='aw3'?'The seller reports service history and discloses a chip on the screen edge. Ask for close-up photographs and confirm whether it affects operation.':'Ask the seller for current photographs, any known faults and the latest service information.',
    history:listing.id==='aw3'?'The seller reports under 300,000 shots and says service history is available. Request dated records.':'Service and usage records have not been supplied in this site selection.',
    accessories:listing.id==='aw3'?'The source listing mentions a handpiece, stand and accessories. Confirm the complete itemised list.':'Ask the seller to confirm every handpiece and accessory included.',
    sourceHref:origin+listing.path
  }}/>;
}
