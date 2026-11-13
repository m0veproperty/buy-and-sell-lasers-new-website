import type {Marketplace} from './service.ts';
import {wordpressInventory} from './operator-inventory.ts';
import {listings,origin} from '../lib/listings.ts';
import type {HomeMachine} from '../lib/home-machines.ts';

type ProductFacts={price:number|null;year:string;categories:string[]};
const machineCategories:Record<string,string>={'Laser hair removal':'Hair removal','Laser tattoo removal':'Tattoo removal',
  'IPL machines':'IPL','All-in-one machines':'All-in-one','Skin treatment':'Skin treatment','Slimming machines':'Slimming'};

export async function homeMachines(service:Marketplace):Promise<HomeMachine[]>{
  const [wordpress,native]=await Promise.all([wordpressInventory(service,{includeContacts:false}),service.published()]);
  const facts=JSON.parse(process.env.MARKETPLACE_HOME_PRODUCT_FACTS??'{}') as Record<string,ProductFacts>;
  const legacy:HomeMachine[]=(wordpress?.machines??[]).flatMap(machine=>{
    if(machine.status!=='publish'||machine.classification==='unclassified')return [];
    const featured=machine.classification==='genuine';
    const example=listings.find(item=>item.path.split('/').at(-2)===machine.slug);
    const info=facts[machine.id];
    return [{
      id:'wp-'+machine.id,title:example?example.brand+' '+example.name:machine.title,
      category:info?.categories??(example?[example.category]:[]),
      year:info?.year||example?.year||'',price:featured?(info?.price??example?.price??null):null,
      image:example?'/images/'+example.image+'-small.webp':machine.image,
      href:featured?(example?.path??origin+'/?post_type=product&p='+machine.id):undefined,
      description:featured?example?.description:undefined,featured,
      spotlight:featured?example?.id:undefined
    }];
  });
  const current:HomeMachine[]=native.map(item=>({
    id:item.id,title:item.data.make+' '+item.data.model,category:[machineCategories[item.data.category]??item.data.category],
    year:item.data.year,price:Number(item.data.askingPrice),image:item.photos[0]?'/api/marketplace/photos/'+item.photos[0]:undefined,
    href:'/equipment/'+item.id,description:item.data.condition,featured:true
  }));
  return [...current,...legacy.sort((a,b)=>Number(b.spotlight==='aw3')-Number(a.spotlight==='aw3')||
    Number(Boolean(b.spotlight))-Number(Boolean(a.spotlight))||Number(b.year)-Number(a.year))];
}
