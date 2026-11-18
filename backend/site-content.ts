import {categories,listings} from '@/lib/listings';
import {guides} from '@/lib/guides';
import {listingPackages} from '@/lib/listing-packages';
import type {Marketplace} from './service';

export type SiteEntry={title:string;path:string;group:string;detail?:string};
export type SiteContent={pages:SiteEntry[];posts:SiteEntry[]};

const corePages:SiteEntry[]=[
  {title:'Home',path:'/',group:'Main'},
  {title:'Shop',path:'/shop/',group:'Main'},
  {title:'Sell your laser',path:'/sell-your-laser/',group:'Main'},
  {title:'About us',path:'/about/',group:'Main'},
  {title:'Why choose us',path:'/choose-us/',group:'Main'},
  {title:'Contact',path:'/contact/',group:'Main'},
  {title:'Blog',path:'/blog/',group:'Main'},
  {title:'Privacy policy',path:'/privacy-policy/',group:'Information'},
  {title:'Terms and conditions',path:'/terms-and-conditions/',group:'Information'},
  {title:'Account',path:'/account',group:'Account',detail:'Sign-in and seller account'},
];

export async function siteContent(service:Marketplace):Promise<SiteContent>{
  const liveListings=await service.published();
  return {
    pages:[
      ...corePages,
      ...categories.map(category=>({title:category.name,path:category.path,group:'Equipment categories'})),
      ...listingPackages.map(pack=>({title:`${pack.name} listing package`,path:`/sell-my-laser/${pack.id}/`,group:'Listing packages'})),
      ...listings.map(listing=>({title:`${listing.brand} ${listing.name}`,path:listing.path,group:'Catalogue machines',detail:listing.year})),
      ...liveListings.map(listing=>({title:`${listing.data.make} ${listing.data.model}`,path:`/equipment/${listing.id}`,group:'Live seller listings',detail:listing.data.year})),
    ],
    posts:guides.map(guide=>({title:guide.title,path:`/${guide.slug}/`,group:guide.tag,detail:guide.subtitle})),
  };
}
