'use client';
import {useEffect,useRef,useState} from 'react';
import {ArrowUpRight,ChevronDown,Menu,X,Check} from 'lucide-react';
import {listings,Listing,categories} from '@/lib/listings';
import LaserExperience from './LaserExperience';
import BeamAtmosphere from './BeamAtmosphere';
import EquipmentBrowser from './EquipmentBrowser';
import './inspection-artwork.css';
import './homepage-refresh.css';
import {Selling,BuyingPath,Enquiry,Faq,Closing,FooterLinks} from './Journey';

function Brand({light=false}:{light?:boolean}){return <a href="#top" className={`brand ${light?'brand-light':''}`} aria-label="Buy and Sell Lasers home"><svg viewBox="0 0 36 36" aria-hidden="true"><path d="M5 5h10v10H5zM21 5h10v10H21zM5 21h10v10H5zM21 21h10v10H21z"/><path className="brand-beam" d="M16 0h4v36h-4z"/></svg><span>buy & sell<span className="brand-second">lasers<span className="brand-dot">®</span></span></span></a>}
function Action({children,href,className=''}:{children:React.ReactNode;href:string;className?:string}){return <a className={`action ${className}`} href={href}><span>{children}</span><ArrowUpRight size={18}/></a>}
function Eyebrow({children,dark=false}:{children:React.ReactNode;dark?:boolean}){return <p className={`eyebrow ${dark?'on-dark':''}`}><span/>{children}</p>}
export default function Home({variant='centered'}:{variant?:'centered'|'split'}){
 const [menu,setMenu]=useState(false),[selected,setSelected]=useState<Listing>(listings[0]),[chapter,setChapter]=useState(0);
 const inspection=useRef<HTMLElement>(null);
 useEffect(()=>{const observer=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('is-visible');observer.unobserve(e.target);}}),{threshold:.08});document.querySelectorAll('[data-reveal]').forEach(e=>observer.observe(e));return()=>observer.disconnect();},[]);
 const chooseChapter=(n:number)=>setChapter(n);
 return <><div id="top"/><a className="skip-link" href="#main">Skip to content</a><header className="site-header"><div className="header-inner"><Brand/><nav className={menu?'nav open':'nav'} aria-label="Main navigation"><details className="buy-menu"><summary>Buy equipment <ChevronDown size={13}/></summary><div className="dropdown"><a href="#home.finder" onClick={()=>setMenu(false)}>Explore all equipment <ArrowUpRight size={15}/></a>{categories.map(c=><a key={c.name} href={c.path}>{c.name}<ArrowUpRight size={14}/></a>)}</div></details><a className="mobile-contact" href={'/sell-your-laser/'}>Sell your machine</a><a href={'/blog/'}>Buying guides</a><a href={'/about/'}>About</a><a className="mobile-contact" href={'/contact/'}>Contact</a></nav><a className="header-contact" href={'/sell-your-laser/'}>Sell your machine <ArrowUpRight size={17}/></a><button className="menu-toggle" aria-label={menu?'Close menu':'Open menu'} aria-expanded={menu} onClick={()=>setMenu(!menu)}>{menu?<X/>:<Menu/>}</button></div></header>
 <main id="main" className="homepage-refresh"><LaserExperience variant={variant}/>
 <EquipmentBrowser selected={selected} onSelect={setSelected}/>
 <Inspection sectionRef={inspection} selected={selected} chapter={chapter} chooseChapter={chooseChapter}/>
 <Selling/><BuyingPath/><Enquiry selected={selected}/><Faq/><Closing/>
 </main><footer className="site-footer"><div className="footer-top"><Brand/><p>Equipment. Possibility.<br/>A clearer next step.</p><a href="#top">Back to top <ArrowUpRight size={17}/></a></div><FooterLinks/><div className="footer-bottom"><span>© 2026 Buy & Sell Lasers</span><span>REAL EQUIPMENT. NEW POSSIBILITIES.</span></div></footer></>;
}
function Inspection({sectionRef,selected,chapter,chooseChapter}:{sectionRef:React.RefObject<HTMLElement|null>;selected:Listing;chapter:number;chooseChapter:(n:number)=>void}){
 const titles=['The whole picture.','The details that count.','Ask for the evidence.'];
 const descriptions=[
  'Look beyond the model name. Compare the exact configuration, included handpieces and current usage. Ask to see the actual machine and arrange a demonstration before taking the next step.',
  'Look closely at the screen, casing, handpieces and connectors. Ask for recent photographs, details of any wear or known faults, and confirmation of how the equipment is operating.',
  'Ask for dated service records, current usage readings and an itemised accessory list. Match the documentation to the machine and agree what is included before arranging the handover.'
 ];
 const cues=['Configuration, accessories and usage','Screen, handpieces and connectors','Service history and documentation'];
 return <section id="home.inspect" className="inspection-section" ref={sectionRef}><div className="inspection-sticky"><BeamAtmosphere tone="dark"/><div className="inspection-top"><Eyebrow dark>LOOK BEYOND THE LISTING</Eyebrow><span className="inspection-kicker">A CLOSER LOOK. A CLEARER CHOICE.</span></div><div className="inspection-layout"><div className="inspection-copy"><h2 data-reveal>Good decisions.<br/><span>In the details.</span></h2><p className="section-intro">A machine is more than a model number.<br/>Take a closer look at what matters.</p><div className="chapter-tabs" role="tablist" aria-label="Equipment inspection">{['Overview','Condition','Records'].map((s,i)=><button key={s} role="tab" id={`inspection-tab-${i}`} aria-controls={`inspection-panel-${i}`} aria-selected={chapter===i} tabIndex={chapter===i?0:-1} onClick={()=>chooseChapter(i)} onKeyDown={e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();const next=(i+(e.key==='ArrowRight'?1:2))%3;chooseChapter(next);document.getElementById(`inspection-tab-${next}`)?.focus();}}}>{s}</button>)}</div><div className="chapter-copy" role="tabpanel" id={`inspection-panel-${chapter}`} aria-labelledby={`inspection-tab-${chapter}`}><span className="micro-label">WHAT TO LOOK FOR</span><h3>{titles[chapter]}</h3><p>{descriptions[chapter]}</p></div><Action href={selected.path} className="action-lime">View selected listing</Action><noscript><div className="static-inspection"><h3>Condition and records</h3><p>{descriptions[1]}</p><p>{descriptions[2]}</p></div></noscript></div><div className={`inspection-media chapter-${chapter}`}><figure className="inspection-photo inspection-artwork">
  <div className="studio-halo" aria-hidden="true"/>
  <img src="/images/laser-studio-2026.webp" alt="Illustration of an unbranded silver aesthetic laser console with blue accents" width="933" height="1400" loading="lazy" decoding="async"/>
  <figcaption className="photo-label">Illustrative equipment</figcaption>
</figure><div className="inspection-cue"><Check size={18} aria-hidden="true"/><span>{cues[chapter]}</span></div></div></div><div className="inspection-bottom"><span>BUY WITH YOUR QUESTIONS ANSWERED.</span><span>EXPLORE THE THREE CHECKS ABOVE</span></div></div></section>;
}
