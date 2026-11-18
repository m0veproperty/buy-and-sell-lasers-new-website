'use client';

import {useEffect,useState,type FormEvent} from 'react';
import {Boxes, ExternalLink, FileText, LayoutGrid, Mail, Newspaper, ShieldCheck} from 'lucide-react';
import WordPressInventory from './WordPressInventory';
import PortalThumbnail from './PortalThumbnail';
import SiteContent from './SiteContent';
import {listingPackages} from '@/lib/listing-packages';
import type {WordPressMachine} from '@/backend/operator-inventory';
import type {Machine} from '@/backend/service';
import type {SiteContent as Content} from '@/backend/site-content';

type OperatorListing = {
  id:string;
  data:Machine;
  state:string;
  paymentIncidents:string[];
  sellerEmail:string;
  sellerName:string;
  packageId:string|null;
  expiresAt:number|null;
  photos:string[];
  flags:string[];
};
type Inventory = {capturedAt:string;machines:WordPressMachine[]};
type Notification = {listing_id:string;kind:'approval_request'|'listing_live';recipient:string;subject:string;body:string;sent_at:number|null};
type View='inventory'|'new-site'|'emails'|'pages'|'posts';
const views:View[]=['inventory','new-site','emails','pages','posts'];
const headings:Record<View,{title:string;description:string}>={
  inventory:{title:'Machine inventory',description:'Review the WordPress machine snapshot and listing details.'},
  'new-site':{title:'New-site listings',description:'Review paid listings awaiting approval and listings already live.'},
  emails:{title:'Automated emails',description:'View messages prepared and sent for paid listings.'},
  pages:{title:'Website pages',description:'Browse the pages and live listings published on this website.'},
  posts:{title:'Posts',description:'Browse the published guides and articles.'},
};

export default function OperatorListings(){
  const [result,setResult]=useState<{listings:OperatorListing[];wordpress:Inventory|null;notifications:Notification[];content:Content}|null>(null);
  const [view,setView]=useState<View>('inventory');
  const [error,setError]=useState('');
  const [needsPin,setNeedsPin]=useState(false);
  const [locked,setLocked]=useState(false);
  const [busy,setBusy]=useState(false);

  async function load(signal?:AbortSignal){
    const response=await fetch('/api/marketplace/operator/listings',{cache:'no-store',signal});
    const data=await response.json();
    if(response.status===428){setResult(null);setNeedsPin(true);return;}
    if(response.status===423)setLocked(true);
    if(!response.ok)throw new Error(data.error);
    setNeedsPin(false);
    setResult(data);
  }

  useEffect(()=>{
    const controller=new AbortController();
    void load(controller.signal).catch(error=>{if(!controller.signal.aborted)setError(error.message);});
    return ()=>controller.abort();
  },[]);

  useEffect(()=>{
    const syncView=()=>{
      const hash=window.location.hash.slice(1);
      setView(views.includes(hash as View)?hash as View:'inventory');
    };
    syncView();
    window.addEventListener('hashchange',syncView);
    return ()=>window.removeEventListener('hashchange',syncView);
  },[]);

  async function unlock(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    const form=event.currentTarget;
    const pin=new FormData(form).get('pin');
    form.reset();
    setError('');
    setBusy(true);
    try{
      const response=await fetch('/api/marketplace/operator/unlock',{
        method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pin})
      });
      const data=await response.json();
      if(response.status===423)setLocked(true);
      if(!response.ok)throw new Error(data.error);
      await load();
    }catch(error){
      setError(error instanceof Error?error.message:'Unable to unlock the portal.');
    }finally{
      setBusy(false);
    }
  }

  async function approve(id:string){
    setBusy(true);setError('');
    try{
      const response=await fetch('/api/marketplace/operator/approve/'+encodeURIComponent(id),{method:'POST'});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error);
      await load();
    }catch(error){
      setError(error instanceof Error?error.message:'Could not approve the listing.');
    }finally{setBusy(false);}
  }

  async function lock(){
    try{
      const response=await fetch('/api/marketplace/operator/lock',{method:'POST'});
      if(!response.ok)throw new Error('Could not lock the portal.');
      setResult(null);
      setError('');
      setNeedsPin(true);
    }catch(error){
      setError(error instanceof Error?error.message:'Could not lock the portal.');
    }
  }

  return <div className="portal">
    <aside className="portal-sidebar">
      <div className="portal-brand"><span><Boxes size={21}/></span><div>Buy &amp; Sell Lasers<small>Administration</small></div></div>
      <nav aria-label="Portal navigation">
        <span className="portal-nav-label">Listings</span>
        <a href="#inventory" aria-current={view==='inventory'?'page':undefined}><LayoutGrid size={17}/> Machine inventory</a>
        <a href="#new-site" aria-current={view==='new-site'?'page':undefined}><ShieldCheck size={17}/> New-site listings</a>
        <a href="#emails" aria-current={view==='emails'?'page':undefined}><Mail size={17}/> Automated emails</a>
        <span className="portal-nav-label">Website</span>
        <a href="#pages" aria-current={view==='pages'?'page':undefined}><FileText size={17}/> Pages</a>
        <a href="#posts" aria-current={view==='posts'?'page':undefined}><Newspaper size={17}/> Posts</a>
      </nav>
      {result&&<button className="portal-lock" onClick={lock}>Lock portal</button>}
      <a className="portal-public" href="/">View public site <ExternalLink size={15}/></a>
    </aside>
    <main id={view} className="portal-main">
      <header className="portal-heading"><h1>{headings[view].title}</h1><p>{headings[view].description}</p></header>
      {error&&<div className="portal-panel" role="alert">{error}</div>}
      {needsPin&&!locked&&<section className="portal-panel portal-pin">
        <h2>Unlock the portal</h2>
        <p>Enter your six-digit PIN. Three incorrect attempts lock access.</p>
        <form onSubmit={unlock}>
          <label>Portal PIN<input name="pin" type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required autoFocus/></label>
          <button disabled={busy}>Unlock</button>
        </form>
      </section>}
      {!result&&!error&&!needsPin&&!locked&&<p role="status">Loading portal…</p>}
      {result&&<>
        {view==='inventory'&&<WordPressInventory inventory={result.wordpress}/>}
        {view==='new-site'&&<section className="portal-panel">
          <h2>New-site listings</h2>
          {result.listings.length===0&&<p>No listings are live or on payment hold.</p>}
          {result.listings.map(listing=>{
            const pack=listingPackages.find(item=>item.id===listing.packageId);
            return <article className="portal-new-row" key={listing.id}>
              <PortalThumbnail src={listing.photos[0]&&'/api/marketplace/photos/'+listing.photos[0]}/>
              <div><h3>{listing.data.make} {listing.data.model}</h3><p>{listing.data.year} · {listing.data.category} · £{listing.data.askingPrice}</p>
              <p>{listing.sellerName} · <a href={'mailto:'+listing.sellerEmail}>{listing.sellerEmail}</a></p>
              <p>{pack?pack.name+' · '+pack.durationDays+' days':'Duration unavailable'}{listing.expiresAt&&' · Ends '+new Date(listing.expiresAt).toLocaleDateString('en-GB',{timeZone:'Europe/London'})}</p>
              {listing.flags.length>0&&<ul>{listing.flags.map(flag=><li key={flag}>{flag}</li>)}</ul>}
              {listing.state==='pending_review'&&<><p className="portal-hold">Paid · awaiting approval</p><p>{listing.data.description||'No seller description provided.'}</p><button disabled={busy||result.notifications.some(n=>n.listing_id===listing.id&&n.kind==='approval_request'&&!n.sent_at)} onClick={()=>approve(listing.id)}>Approve and publish</button></>}
              {listing.paymentIncidents.length>0&&<p className="portal-hold">Payment hold · {listing.paymentIncidents.map(event=>event.split('.').at(-1)?.toLowerCase()).join(', ')}</p>}
              {listing.state==='published'&&<a href={'/equipment/'+listing.id}>View live listing</a>}</div>
            </article>;
          })}
        </section>}
        {view==='emails'&&<section className="portal-panel">
          <h2>Automated emails</h2>
          <p>Read-only record of the messages prepared for paid listings. Administrators receive an approval request first; the seller receives their product link after approval and publication.</p>
          {!result.notifications.length&&<p>No listing emails have been queued yet.</p>}
          {result.notifications.map((mail,index)=><details className="portal-email" key={mail.listing_id+mail.kind+mail.recipient+index}>
            <summary><strong>{mail.kind==='approval_request'?'Administrator approval request':'Seller listing live'}</strong> · {mail.recipient} · {mail.sent_at?'Sent '+new Date(mail.sent_at).toLocaleString('en-GB',{timeZone:'Europe/London'}):'Queued'}</summary>
            <p><strong>Subject:</strong> {mail.subject}</p><pre>{mail.body}</pre>
          </details>)}
        </section>}
        {(view==='pages'||view==='posts')&&<SiteContent content={result.content} view={view}/>}
      </>}
    </main>
  </div>;
}
