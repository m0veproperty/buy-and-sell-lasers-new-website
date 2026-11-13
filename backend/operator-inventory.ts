import {ApiError,Marketplace,text,type User} from './service.ts';

export type Classification = 'genuine'|'demo'|'unclassified';
export type ListingContact = {name:string;email:string;phone:string;package:string;durationDays:number|null;expires:string|null};
export type WordPressMachine = {
  id:number;
  title:string;
  slug:string;
  status:'publish'|'draft';
  source:string|null;
  pluginStatus:string|null;
  paymentStatus:string|null;
  classification:Classification;
  note:string;
  image?:string;
  contact?:ListingContact;
};

type Snapshot = {capturedAt:string;machines:Omit<WordPressMachine,'classification'|'note'|'contact'>[]};

function snapshot(){
  const raw=process.env.MARKETPLACE_WORDPRESS_INVENTORY;
  return raw?JSON.parse(raw) as Snapshot:null;
}

export async function wordpressInventory(service:Marketplace){
  const inventory=snapshot();
  if(!inventory)return null;
  const labels=await service.db.all<{product_id:number;label:Classification;note:string}>(
    'SELECT product_id,label,note FROM wordpress_inventory_labels');
  const byId=new Map(labels.map(label=>[label.product_id,label]));
  const rawContacts=process.env.MARKETPLACE_WORDPRESS_CONTACTS;
  const contacts=rawContacts?JSON.parse(rawContacts) as Record<string,ListingContact>:{};
  return {...inventory,machines:inventory.machines.map(machine=>{
    const classification=byId.get(machine.id)?.label??(machine.source==='laser_market_form'?'genuine':'demo');
    return {
      ...machine,classification,
      note:byId.get(machine.id)?.note??(machine.source==='laser_market_form'
        ?'Submitted through the Laser Market form.'
        :'No Laser Market form submission. Classified as a placeholder by the site owner’s rule.'),
      contact:classification==='genuine'?contacts[machine.id]:undefined
    };
  })};
}

export async function labelWordPressMachine(service:Marketplace,user:User,id:string,input:Record<string,unknown>){
  await service.requireOperator(user);
  const productId=Number(id);
  if(!Number.isSafeInteger(productId)||!snapshot()?.machines.some(machine=>machine.id===productId)){
    throw new ApiError(404,'WordPress machine not found.');
  }
  const label=input.classification;
  if(label!=='genuine'&&label!=='demo'&&label!=='unclassified')throw new ApiError(400,'Choose a classification.');
  const note=text(input.note??'','Classification note',500,label==='unclassified'?0:1);
  await service.db.run(`INSERT INTO wordpress_inventory_labels VALUES(?,?,?,?,?)
    ON CONFLICT(product_id) DO UPDATE SET label=excluded.label,note=excluded.note,
    operator_id=excluded.operator_id,updated_at=excluded.updated_at`,productId,label,note,user.id,Date.now());
  return {classification:label,note};
}
