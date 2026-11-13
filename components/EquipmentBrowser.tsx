'use client';

import {useEffect,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,ArrowUpRight,Grid2X2,ImageIcon,Layers,Search,SlidersHorizontal,Sparkles,Target,Waves,Zap} from 'lucide-react';
import {categories,listings,money,type Listing} from '@/lib/listings';
import type {HomeMachine} from '@/lib/home-machines';
import './equipment-browser.css';

const icons=[Grid2X2,Waves,Target,Sparkles,Layers,Zap,Waves];

function MachineRail({title,machines,featured,onSelect}:{title:string;machines:HomeMachine[];featured:boolean;onSelect:(item:Listing)=>void}){
  const rail=useRef<HTMLDivElement>(null);
  const [ends,setEnds]=useState({start:true,end:true});
  useEffect(()=>{
    const element=rail.current;
    if(!element)return;
    const update=()=>setEnds({start:element.scrollLeft<4,end:element.scrollLeft+element.clientWidth>=element.scrollWidth-4});
    element.scrollLeft=0;
    update();
    const observer=new ResizeObserver(update);
    observer.observe(element);
    element.addEventListener('scroll',update,{passive:true});
    return ()=>{observer.disconnect();element.removeEventListener('scroll',update);};
  },[machines]);
  function move(direction:number){
    const element=rail.current;
    if(element)element.scrollBy({left:element.clientWidth*direction,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  }
  const id=featured?'featured-lasers':'more-lasers';
  return <section className={featured?'equipment-rail equipment-featured':'equipment-rail'} aria-labelledby={id}>
    <div className="equipment-rail-title">
      <h3 id={id}>{title}</h3>
      <div className="equipment-rail-line"/>
      {machines.length>0&&<div className="equipment-arrows">
        <button type="button" aria-label={'Previous '+title.toLowerCase()} disabled={ends.start} onClick={()=>move(-1)}><ArrowLeft size={20}/></button>
        <button type="button" aria-label={'Next '+title.toLowerCase()} disabled={ends.end} onClick={()=>move(1)}><ArrowRight size={20}/></button>
      </div>}
    </div>
    {!featured&&<p className="equipment-examples">Example machines for browsing. These are not available listings.</p>}
    {machines.length===0?<p>No {featured?'featured listings':'examples'} match these filters.</p>:
      <div className="equipment-track" ref={rail} tabIndex={0} aria-label={title}>
        {machines.map((machine,index)=>{
          const spotlight=listings.find(item=>item.id===machine.spotlight);
          return <article className="equipment-tile" key={machine.id}>
            <div className="equipment-photo">
              {machine.image?<img src={machine.image} alt={machine.title} loading="lazy" width={400} height={260}/>:<ImageIcon size={38} aria-hidden="true"/>}
              {featured&&index===0&&<span className="equipment-ribbon"><Sparkles size={14}/> Featured</span>}
            </div>
            <div className="equipment-tile-content">
              <div className="equipment-meta">{machine.category[0]&&<span>{machine.category[0]}</span>}<small>{machine.year}</small></div>
              <h4>{machine.href?<a href={machine.href}>{machine.title}</a>:machine.title}</h4>
              {machine.description&&<p>{machine.description}</p>}
              <div className="equipment-tile-bottom">
                {machine.price!==null?<span><strong>{money(machine.price)}</strong> <small>asking price</small></span>:<small>{featured?'See listing for price':'Catalogue example'}</small>}
                {machine.href&&<a href={machine.href} aria-label={'View '+machine.title}><ArrowUpRight size={20}/></a>}
              </div>
              {spotlight&&<a className="equipment-inspect" href="#home.inspect" onClick={()=>onSelect(spotlight)}>Inspect machine</a>}
            </div>
          </article>;
        })}
      </div>}
  </section>;
}

export default function EquipmentBrowser({onSelect}:{selected:Listing;onSelect:(item:Listing)=>void}){
  const [machines,setMachines]=useState<HomeMachine[]|null>(null);
  const [error,setError]=useState(false);
  const [category,setCategory]=useState('All equipment');
  const [query,setQuery]=useState('');
  const [budget,setBudget]=useState('');
  const [sort,setSort]=useState('featured');
  useEffect(()=>{
    const controller=new AbortController();
    fetch('/api/marketplace/home-machines',{signal:controller.signal}).then(async response=>{
      if(!response.ok)throw new Error('Catalogue unavailable');
      setMachines((await response.json()).machines);
    }).catch(()=>{if(!controller.signal.aborted)setError(true);});
    return ()=>controller.abort();
  },[]);
  const matches=(machines??[]).filter(machine=>
    (category==='All equipment'||machine.category.includes(category))&&
    (!budget||!machine.featured||(machine.price!==null&&machine.price<=Number(budget)))&&
    [machine.title,machine.year,...machine.category].join(' ').toLowerCase().includes(query.trim().toLowerCase())
  ).sort((a,b)=>{
    if(sort==='featured')return 0;
    if(a.price===null)return b.price===null?0:1;
    if(b.price===null)return -1;
    return sort==='low'?a.price-b.price:b.price-a.price;
  });

  return <section className="equipment-showcase" id="home.finder">
    <div className="section-shell">
      <header className="equipment-heading">
        <h2>A new possibility.<br/><em>The right equipment.</em></h2>
        <p><strong>Explore the equipment that fits your plans.</strong><br/>Compare professional laser and light-based systems for your next upgrade.</p>
      </header>
      <div className="equipment-categories" aria-label="Equipment categories">
        {['All equipment',...categories.map(item=>item.name)].map((name,index)=>{
          const Icon=icons[index];
          return <button type="button" key={name} aria-pressed={name===category} onClick={()=>setCategory(name)}><Icon size={20}/>{name}</button>;
        })}
      </div>
      <div className="equipment-filters">
        <label><Search size={18}/><span className="sr-only">Search machines</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search a brand or model"/></label>
        <label><SlidersHorizontal size={16}/><span className="sr-only">Maximum asking price</span><select value={budget} onChange={e=>setBudget(e.target.value)}><option value="">Any asking price</option>{[2000,5000,10000,20000].map(value=><option key={value} value={value}>Up to {money(value)}</option>)}</select></label>
        <label><span className="sr-only">Sort by</span><select value={sort} onChange={e=>setSort(e.target.value)}><option value="featured">Featured first</option><option value="low">Price: low to high</option><option value="high">Price: high to low</option></select></label>
      </div>
      <div id="home.listings">
        {!machines&&!error&&<p role="status">Loading machines…</p>}
        {error&&<p role="status">The homepage inventory is temporarily unavailable. <a href="/shop/">Browse the shop</a>.</p>}
        {machines&&<>
          <MachineRail title="Featured lasers" machines={matches.filter(machine=>machine.featured)} featured onSelect={onSelect}/>
          <MachineRail title="More lasers" machines={matches.filter(machine=>!machine.featured)} featured={false} onSelect={onSelect}/>
        </>}
      </div>
    </div>
  </section>;
}
