'use client';
import {useEffect,useState} from 'react';
import {ArrowRight,ArrowUpRight,ImageIcon,Layers3,RotateCcw,Search,ShieldCheck,SlidersHorizontal} from 'lucide-react';
import {Listing,listings,categories,money} from '@/lib/listings';
import type {HomeMachine} from '@/lib/home-machines';

type Card={id:string;title:string;manufacturer:string;year:string;categories:string[];price:number|null;image?:string;href:string;description?:string;condition:string};
function toCard(item:Listing|HomeMachine):Card{
  if('path' in item)return {id:item.id,title:item.name,manufacturer:item.brand,year:item.year,categories:[item.category],price:item.price,image:`/images/${item.image}-small.webp`,href:item.path,description:item.description,condition:item.conditionGrade??'Not stated'};
  const manufacturer=item.manufacturer??'Not stated';
  const title=manufacturer!=='Not stated'&&item.title.toLowerCase().startsWith(manufacturer.toLowerCase()+' ')?item.title.slice(manufacturer.length+1):item.title;
  return {id:item.id,title,manufacturer,year:item.year,categories:item.category,price:item.price,image:item.image,href:item.href??'/shop/',description:item.description,condition:item.condition??'Not stated'};
}
export function ProductCard({listing}:{listing:Listing|HomeMachine}){
  const item=toCard(listing);
  return <article className="equipment-result-card"><a className="equipment-result-photo" href={item.href} aria-label={`View ${item.title}`}>
    {item.image?<img src={item.image} alt={item.title} loading="lazy" width="520" height="390"/>:<ImageIcon size={36} aria-hidden="true"/>}
    <span>{item.condition==='Not stated'?'Condition to confirm':item.condition}</span></a>
    <div className="equipment-result-body"><small>{item.year||'Year to confirm'} · {item.categories.join(' · ')}</small>
      <h3><a href={item.href}>{item.manufacturer==='Not stated'?'':item.manufacturer+' '}{item.title}</a></h3>
      <div className="equipment-result-bottom"><strong>{item.price===null?'Price on enquiry':money(item.price)}</strong><a href={item.href} aria-label={`View ${item.title}`}><ArrowRight size={19}/></a></div>
    </div></article>;
}
export default function Catalogue({category='All equipment',hideIntro=false}:{category?:string;hideIntro?:boolean}){
  const [query,setQuery]=useState(''),[price,setPrice]=useState(''),[condition,setCondition]=useState(''),[manufacturer,setManufacturer]=useState(''),[sort,setSort]=useState('featured');
  const [live,setLive]=useState<HomeMachine[]|null>(null),[liveError,setLiveError]=useState(false);
  useEffect(()=>{const controller=new AbortController();fetch('/api/marketplace/home-machines',{cache:'no-store',signal:controller.signal}).then(async response=>{
    if(!response.ok)throw new Error('Inventory unavailable');const machines=(await response.json() as {machines:HomeMachine[]}).machines;
    if(!machines.length)throw new Error('Inventory unavailable');setLive(machines.filter(item=>item.featured&&!!item.href));
  }).catch(()=>{if(!controller.signal.aborted)setLiveError(true);});return ()=>controller.abort();},[]);
  const inventory:Card[]=(live??listings.filter(item=>item.id!=='vcombo')).map(toCard);
  const pool=inventory.filter(item=>category==='All equipment'||item.categories.includes(category));
  const manufacturers=[...new Set(pool.map(item=>item.manufacturer).filter(name=>name!=='Not stated'))].sort();
  const conditions=[...new Set(pool.map(item=>item.condition))].sort();
  const matches=pool.filter(item=>(item.title+' '+item.manufacturer+' '+item.year).toLowerCase().includes(query.trim().toLowerCase())&&
    (!price||(item.price!==null&&item.price<=Number(price)))&&(!condition||item.condition===condition)&&(!manufacturer||item.manufacturer===manufacturer))
    .sort((a,b)=>sort==='low'?(a.price??Infinity)-(b.price??Infinity):sort==='high'?(b.price??-1)-(a.price??-1):sort==='new'?Number(b.year)-Number(a.year):0);
  function reset(){setQuery('');setPrice('');setCondition('');setManufacturer('');setSort('featured');}
  return <div className="catalogue-v2">
    {!hideIntro&&<section className="catalogue-hero"><div className="page-width"><nav className="breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a><span>/</span><span>Equipment</span></nav><p className="eyebrow">ALL EQUIPMENT</p><h1>Find equipment for<br/><em>your next chapter.</em></h1><p>Browse pre-owned laser and aesthetic equipment. Compare the details, then speak directly with the seller.</p><a className="action" href="#category-equipment">Browse equipment <ArrowRight size={17}/></a></div></section>}
    <div className="catalogue-benefits page-width" aria-label="How to compare"><div><ShieldCheck/><span><strong>Seller details</strong><small>Ask questions directly</small></span></div><div><Layers3/><span><strong>Compare the model</strong><small>Photos, condition and history</small></span></div><div><SlidersHorizontal/><span><strong>Find your fit</strong><small>Filter by category and price</small></span></div></div>
    <div id="category-equipment" className="catalogue-v2-layout page-width"><aside className="catalogue-v2-sidebar"><h2>Filter results</h2><div className="catalogue-v2-categories"><h3>Category</h3><a className={category==='All equipment'?'active':''} href="/shop/">All equipment <span>{inventory.length}</span></a>{categories.map(item=><a className={category===item.name?'active':''} key={item.path} href={item.path}>{item.name}<span>{inventory.filter(machine=>machine.categories.includes(item.name)).length}</span></a>)}</div>
      <label>Maximum price<select value={price} onChange={event=>setPrice(event.target.value)}><option value="">Any price</option>{[2000,5000,10000,20000,50000].map(value=><option value={value} key={value}>Up to {money(value)}</option>)}</select></label>
      <label>Condition<select value={condition} onChange={event=>setCondition(event.target.value)}><option value="">Any condition</option>{conditions.map(value=><option value={value} key={value}>{value}</option>)}</select></label>
      <label>Manufacturer<select value={manufacturer} onChange={event=>setManufacturer(event.target.value)}><option value="">Any manufacturer</option>{manufacturers.map(value=><option value={value} key={value}>{value}</option>)}</select></label>
      <button className="catalogue-reset" onClick={reset}><RotateCcw size={15}/> Reset filters</button>
    </aside><div className="catalogue-v2-main"><div className="catalogue-v2-toolbar"><p role="status"><strong>{matches.length}</strong> {matches.length===1?'machine':'machines'} found{!live&&!liveError?' · loading current listings':''}</p><label>Sort by <select value={sort} onChange={event=>setSort(event.target.value)}><option value="featured">Featured first</option><option value="new">Newest model year</option><option value="low">Price: low to high</option><option value="high">Price: high to low</option></select></label></div>
      <label className="catalogue-v2-search"><Search size={18}/><span className="sr-only">Search equipment</span><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search brand, model or year"/></label>
      {matches.length?<div className="catalogue-v2-grid">{matches.map(item=><ProductCard key={item.id} listing={{id:item.id,title:item.title,manufacturer:item.manufacturer,year:item.year,category:item.categories,price:item.price,image:item.image,href:item.href,description:item.description,condition:item.condition,featured:true}}/>)}</div>:<div className="catalogue-empty"><Search size={32}/><h2>No machines match these filters.</h2><p>Try another category, manufacturer or price.</p><button className="action" onClick={reset}>Reset filters</button></div>}
      {liveError&&<p className="catalogue-v2-note">Current marketplace listings could not be loaded. This is the last available site selection.</p>}
      <section className="catalogue-guide-promo"><div><p className="eyebrow">BUYING GUIDE</p><h2>Know what to ask<br/>before you buy.</h2><p>Check the machine, records and exact configuration.</p><a href="/how-to-buy-a-pre-owned-cosmetic-laser-safely/">Read the guide <ArrowUpRight size={16}/></a></div></section>
    </div></div>
    <section className="page-width catalogue-v2-faq"><div><p className="eyebrow">COMMON QUESTIONS</p><h2>Buy with clarity.</h2><p>Talk directly to the seller and check the details before agreeing a purchase.</p></div><div><details><summary>What should I check before buying?</summary><p>Confirm the model, condition, included accessories, service records and any known faults. Arrange an inspection where possible.</p></details><details><summary>Does “refurbished” include a warranty?</summary><p>Ask the seller what work was done and whether a written warranty is included. The term alone does not guarantee one.</p></details></div></section>
  </div>;
}
