export const equipmentCategories=['Hair removal','Tattoo removal','IPL','All-in-one','Skin treatment','Slimming','Other equipment'] as const;
export type EquipmentCategory=typeof equipmentCategories[number];
export const sellerCategoryNames:Record<string,EquipmentCategory>={
  'Laser hair removal':'Hair removal','Laser tattoo removal':'Tattoo removal','IPL machines':'IPL',
  'All-in-one machines':'All-in-one','Skin treatment':'Skin treatment','Slimming machines':'Slimming',
  'Other equipment':'Other equipment'
};

// Source titles identify the treatment family for this legacy WordPress snapshot.
// A broad/unknown title is placed in Other equipment rather than assigned a clinical use.
const exceptions:Record<number,EquipmentCategory[]>={
  5400:['Hair removal'],5438:['IPL','Hair removal','Tattoo removal','All-in-one'],
  5472:['IPL','Hair removal','Tattoo removal','All-in-one'],5491:['IPL','Hair removal','Tattoo removal','All-in-one'],
  5510:['IPL','Hair removal','Tattoo removal','Skin treatment','All-in-one'],
  5818:['Skin treatment'],5822:['Skin treatment','Slimming'],5831:['Slimming'],5849:['Skin treatment'],
  10152:['IPL'],10180:['Other equipment'],10197:['IPL'],
  5912:['Hair removal'],6765:['Other equipment'],6642:['Other equipment']
};

export function categoriesForWordPress(id:number,title:string):EquipmentCategory[]{
  if(exceptions[id])return exceptions[id];
  const name=title.toLowerCase();
  const found:EquipmentCategory[]=[];
  if(/hair removal|diode|alexandrite|lightsheer|soprano|apogee|excel hr|tri.?laze|erays|schnelle|elite iq|light sp?t/i.test(name))found.push('Hair removal');
  if(/tattoo|q.?switch|revlite|q-plus|enlighten|nd.?yag/i.test(name))found.push('Tattoo removal');
  if(/\bipl\b|e.?light|excelight|starlux|skinpulse/i.test(name))found.push('IPL');
  if(/skin|rf\b|vivace|exilis|accent|rejuvenation/i.test(name))found.push('Skin treatment');
  if(/slim|contour|cryo|velashape|coolsculpt|ems/i.test(name))found.push('Slimming');
  if(/all.?in.?one|[23].?in.?1|v combo|titan 3/i.test(name))found.push('All-in-one');
  return found.length?found:['Other equipment'];
}

const manufacturers=['All White Laser','Lumenis','Lynton','Cynosure','Quanta','Ellipse','Alma','Syneron','Sciton','Zeltiq','Cutera','Palomar','BTL','AW3','Cosmedico','Quirumed','N-Lase','Nu','ACE'];
export function manufacturerForWordPress(title:string){
  return manufacturers.find(name=>title.toLowerCase().startsWith(name.toLowerCase()+' ')||title.toLowerCase()===name.toLowerCase())??'Not stated';
}
export function conditionForWordPress(title:string){
  return /refurbished/i.test(title)?'Refurbished':/ex[- ]?demo/i.test(title)?'Ex-demo':/\bused\b/i.test(title)?'Used':'Not stated';
}
