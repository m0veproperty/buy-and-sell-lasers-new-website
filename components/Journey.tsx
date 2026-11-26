'use client';
import {useEffect,useState} from 'react';
import {ArrowUpRight,Plus,Check,ClipboardCheck,FileText,Layers,Camera,Mail,BookOpen,Play,MessageSquare} from 'lucide-react';
import {Listing,money,origin} from '@/lib/listings';
import './seller-showcase.css';
import BeamAtmosphere from './BeamAtmosphere';
function Label({children}:{children:React.ReactNode}){return <p className="eyebrow"><span/>{children}</p>}
export function Selling(){
 const steps=[
  {Icon:Layers,title:'Tell the whole story.',description:'Include the make, model, year and configuration, plus usage and known faults.'},
  {Icon:Camera,title:'Put the details in focus.',description:'Add clear, well-lit photos of the machine, screen and key accessories.'},
  {Icon:ClipboardCheck,title:'Have the records ready.',description:'Provide service history, documentation and any relevant test results.'},
 ];
 return <section id="home.sell" className="seller-showcase" aria-labelledby="seller-showcase-title">
  <BeamAtmosphere/><div className="section-shell seller-showcase-inner">
   <figure className="seller-art-stage"><div className="studio-halo" aria-hidden="true"/><div className="seller-light-orbit" aria-hidden="true"/><img className="seller-showcase-art" src="/images/laser-studio-2026.webp" width={933} height={1400} alt="Illustration of an unbranded professional laser machine in silver with blue accents" loading="lazy" decoding="async"/><figcaption>New possibilities for good equipment.</figcaption></figure>
   <div className="seller-showcase-copy">
    <Label>MAKE ROOM FOR WHAT’S NEXT</Label>
    <h2 id="seller-showcase-title">Your machine.<br/>Someone’s <em>next move.</em></h2>
    <p className="seller-showcase-intro">Upgrading your equipment or changing direction? Give another clinic a clear picture of what you have to offer, with honest details, quality photos and the information buyers need to make a confident decision.</p>
    <ul className="seller-showcase-steps">
     {steps.map(({Icon,title,description})=><li key={title}>
      <span className="seller-showcase-icon"><Icon size={27} aria-hidden="true"/></span>
      <div><h3>{title}</h3><p>{description}</p></div>
     </li>)}
    </ul>
    <div className="seller-showcase-actions">
     <a href="/sell-your-laser/" className="action">Start your listing</a>
     <a href="/blog/">Read our buying guides</a>
    </div>
   </div>
  </div>
 </section>;
}
export function BuyingPath(){
 const links=[
  {href:'/how-to-buy-a-pre-owned-cosmetic-laser-safely/',Icon:BookOpen,title:'Know what to look for.',text:'Start with a practical guide to buying pre-owned equipment.',label:'Read the buying guide'},
  {href:'/purchasing-a-second-hand-laser-machine/',Icon:Layers,title:'Compare the whole picture.',text:'Look at configuration, condition and costs alongside the price.',label:'Build a better shortlist'},
  {href:'#home.enquiry',Icon:MessageSquare,title:'Start a useful conversation.',text:'Put your questions together before you contact the seller.',label:'Create your message'},
 ];
 return <section className="buying-path section-shell" aria-labelledby="buying-path-title"><div className="buying-path-heading"><Label>A LITTLE CLARITY GOES A LONG WAY</Label><h2 id="buying-path-title">Your next step.<br/><span>Better informed.</span></h2></div><div className="buying-path-links">{links.map(({href,Icon,title,text,label})=><a key={href} href={href}><Icon size={25} aria-hidden="true"/><h3>{title}</h3><p>{text}</p><span>{label}</span></a>)}</div></section>;
}
const questions=[{id:'service',label:'Service history',detail:'Dated service records and details of the most recent service.',icon:FileText},{id:'accessories',label:'Included accessories',detail:'A complete list of handpieces, cables, stand and other accessories.',icon:Plus},{id:'condition',label:'Condition photographs',detail:'Recent close-ups of the screen, casing, handpieces and any faults.',icon:Camera},{id:'demo',label:'A demonstration',detail:'Options for seeing the equipment and asking about its operation.',icon:Play}];
export function Enquiry({selected}:{selected:Listing}){
 const [chosen,setChosen]=useState<string[]>(['service','condition']),[custom,setCustom]=useState(''),[copied,setCopied]=useState(false),[copyError,setCopyError]=useState(false);
 useEffect(()=>{setCopied(false);setCopyError(false);},[selected.id]);
 const selectedQuestions=questions.filter(q=>chosen.includes(q.id));
 const message=`Hello,\n\nI’m interested in the ${selected.brand} ${selected.name} (${selected.year}), listed at ${money(selected.price)}.${chosen.length?'\n\nCould you please share the following:\n'+selectedQuestions.map(q=>`• ${q.detail}`).join('\n'):''}${custom?'\n\n'+custom:''}\n\nPlease also confirm the current availability and asking price.\n\nThank you.`;
 const toggle=(id:string)=>{setChosen(c=>c.includes(id)?c.filter(x=>x!==id):[...c,id]);setCopied(false);setCopyError(false);};
 return <section id="home.enquiry" className="enquiry-section">
  <BeamAtmosphere/>
  <div className="section-shell enquiry-shell">
   <div className="enquiry-heading">
    <div><Label>BEFORE YOU MESSAGE THE SELLER</Label><h2>Good questions.<br/><em>Better conversations.</em></h2><p>Build a clear, confident message with a ready-made checklist. Get the information you need and make the next conversation count.</p></div>
    <div className="enquiry-art"><div className="studio-halo" aria-hidden="true"/><img src="/images/laser-studio-2026.webp" width="933" height="1400" alt="Illustration of an unbranded laser console" loading="lazy" decoding="async"/><div className="confidence-note"><span><Check size={24} aria-hidden="true"/></span><div><strong>Ask with confidence.</strong><p>The right information.<br/>A clearer next step.</p></div></div></div>
   </div>
   <div className="enquiry-layout">
    <div className="enquiry-options">
     <div className="enquiry-selected"><img src={`/images/${selected.image}-small.webp`} width="85" height="104" alt={`${selected.brand} ${selected.name}`} loading="lazy"/><div><span className="micro-label">YOUR SELECTED EQUIPMENT</span><h3>{selected.brand} {selected.name}</h3><p>{selected.year} · {money(selected.price)} · {selected.category}</p></div><a href="#home.finder" aria-label="Change selected equipment"><ArrowUpRight size={23}/></a></div>
     <div className="enquiry-prompt"><h3>What would you like to know?</h3><span aria-live="polite"><Check size={14} aria-hidden="true"/>{chosen.length} selected</span></div>
     <div className="question-options">{questions.map(q=><button key={q.id} className={chosen.includes(q.id)?'question-option checked':'question-option'} aria-pressed={chosen.includes(q.id)} onClick={()=>toggle(q.id)}><q.icon size={24} aria-hidden="true"/><span>{q.label}<small>{q.detail}</small></span><span className="check-box" aria-hidden="true">{chosen.includes(q.id)&&<Check size={14}/>}</span></button>)}</div>
     <label className="custom-question">Anything else to ask?<textarea rows={2} value={custom} onChange={e=>{setCustom(e.target.value);setCopied(false);setCopyError(false);}} placeholder="Add your own question…" maxLength={600}/></label>
    </div>
    <div className="enquiry-document">
     <div className="document-header"><span><Mail size={21} aria-hidden="true"/>YOUR MESSAGE <span className="preview-label">(PREVIEW)</span></span><span>TO: SELLER</span></div>
     <div className="document-body" aria-live="polite" aria-label="Your message preview"><span className="document-greeting">Hello,</span><p>I’m interested in the <strong>{selected.brand} {selected.name}</strong> ({selected.year}), listed at {money(selected.price)}.</p>{chosen.length>0&&<><p>Could you please share the following:</p><ul>{selectedQuestions.map(q=><li key={q.id}><Check size={18} aria-hidden="true"/><span><strong>{q.label}</strong> — {q.detail}</span></li>)}</ul></>}{chosen.length===0&&<p className="document-empty">Select a topic to add it to your message.</p>}{custom&&<p className="custom-preview">{custom}</p>}<p>Please also confirm the current availability and asking price.</p><p>Thank you.</p></div>
     <div className="document-actions"><button className="copy-button" onClick={async()=>{try{await navigator.clipboard.writeText(message);setCopied(true);setCopyError(false);}catch{setCopied(false);setCopyError(true);}}}>{copied?<Check size={19}/>:<ClipboardCheck size={19}/>} {copied?'Message copied':'Copy message'}</button><a href={origin+selected.path}>View listing & contact seller</a></div>
     <p className="document-note" role="status">{copyError?'Unable to copy automatically. Select and copy the preview text above.':copied?'Copied. Open the listing to send your message to the seller.':'Copy your message, then open the listing to contact the seller. Nothing is sent automatically.'}</p>
    </div>
   </div>
  </div>
 </section>;
}
const faqs=[['How do I contact a seller?','Open the equipment listing and use its seller-contact option. Before making an enquiry, note the exact model and the questions you want answered. This preview links to the existing marketplace for seller contact; it does not submit messages on your behalf.'],['What should I check before buying?','Ask about the model configuration, current condition, usage reading, service history and included accessories. Request recent photographs and a demonstration where appropriate. Confirm support, transport arrangements and any requirements relevant to your clinic directly with the seller and qualified advisers.'],['Are asking prices and availability current?','The prices shown come from the source listings captured for this design preview. Listings can change or be withdrawn. Always confirm the current asking price, availability, included items and any additional costs directly with the seller before agreeing a purchase.'],['How do I prepare my machine for sale?','Gather the make, model, year, service records and current usage information. Take clear photographs of the whole machine, labels, controls and accessories, including visible wear or damage. A complete and accurate description helps a prospective buyer ask more useful questions.'],['Can I compare different types of equipment?','Use the categories and asking-price filter to narrow this selection. Equipment categories are a browsing aid, not a recommendation of clinical suitability. Compare the exact specifications and configuration of each listing, and confirm that the equipment meets your practice’s needs with qualified advice.']];
export function Faq(){return <section id="home.faq" className="faq-section section-shell"><div className="faq-title"><Label>A LITTLE MORE CLARITY</Label><h2>Before you<br/><span>make your move.</span></h2><p>A few useful answers for the next step.<br/>For more detail, explore our buying guides.</p><a className="text-link" href={'/blog/'}>Explore the guides <ArrowUpRight size={16}/></a></div><div className="faq-list">{faqs.map(([q,a],i)=><details key={q}><summary><span className="faq-number">0{i+1}</span>{q}<Plus size={16}/></summary><p>{a}</p></details>)}</div></section>}
export function Closing(){return <section id="home.close" className="closing-section"><BeamAtmosphere tone="dark"/><div className="section-shell closing-inner" data-reveal><div className="closing-symbol" aria-hidden="true"><span/><span/><span/><span/></div><Label>YOUR NEXT CHAPTER STARTS HERE</Label><h2>Make your<br/>next move<span>.</span></h2><p>Find equipment with a future in your clinic.<br/>Or give your machine a new beginning.</p><div className="closing-actions"><a href="#home.finder" className="action">Explore machines <ArrowUpRight size={18}/></a><a href={'/sell-your-laser/'} className="text-link">Sell your machine <ArrowUpRight size={17}/></a></div><span className="closing-fine">BUY & SELL LASERS / EQUIPMENT WITH POSSIBILITY</span></div></section>}
export function FooterLinks(){return <div className="footer-links"><div><span>EXPLORE</span><a href="#home.finder">Buy equipment</a><a href={'/sell-your-laser/'}>Sell your machine</a><a href={'/blog/'}>Buying guides</a></div><div><span>GET TO KNOW US</span><a href={'/about/'}>About</a><a href={'/contact/'}>Contact</a><a href={'/choose-us/'}>Why Buy & Sell Lasers?</a></div><div><span>THE SMALL PRINT</span><a href={'/privacy-policy/'}>Privacy policy</a><a href={'/terms-and-conditions/'}>Terms & conditions</a><p>Design preview · November 2026<br/>Listing details require confirmation.</p></div></div>}
