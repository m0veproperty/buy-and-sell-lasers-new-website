import SiteShell from '@/components/SiteShell';
import OperatorListings from '@/components/OperatorListings';

export const metadata={title:'Live listings | Buy & Sell Lasers',robots:{index:false,follow:false}};
export default function OperatorPage(){
  return <SiteShell><OperatorListings/></SiteShell>;
}
