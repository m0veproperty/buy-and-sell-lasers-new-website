'use client';

import {useEffect,useState,type FormEvent} from 'react';
import {Boxes, ExternalLink, LayoutGrid, ShieldCheck} from 'lucide-react';
import WordPressInventory from './WordPressInventory';
import PortalThumbnail from './PortalThumbnail';
import {listingPackages} from '@/lib/listing-packages';
import type {WordPressMachine} from '@/backend/operator-inventory';
import type {Machine} from '@/backend/service';

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

export default function OperatorListings(){
  const [result,setResult]=useState<{listings:OperatorListing[];wordpress:Inventory|null}|null>(null);
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
        <a href="#inventory"><LayoutGrid size={17}/> Machine inventory</a>
        <a href="#new-site"><ShieldCheck size={17}/> New-site listings</a>
      </nav>
      {result&&<button className="portal-lock" onClick={lock}>Lock portal</button>}
      <a className="portal-public" href="/">View public site <ExternalLink size={15}/></a>
    </aside>
    <main id="inventory" className="portal-main">
      <header className="portal-heading"><h1>Machine inventory</h1><p>Review listing provenance, seller details and publication dates.</p></header>
      {error&&<div className="portal-panel" role="alert">{error}</div>}
      {needsPin&&!locked&&<section className="portal-panel portal-pin">
        <h2>Unlock the portal</h2>
        <p>Enter your six-digit PIN. Three incorrect attempts lock access.</p>
        <form onSubmit={unlock}>
          <label>Portal PIN<input name="pin" type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required autoFocus/></label>
          <button disabled={busy}>Unlock</button>
        </form>
      </section>}
      {!result&&!error&&!needsPin&&!locked&&<p role="status">Loading inventory…</p>}
      {result&&<>
        <WordPressInventory inventory={result.wordpress}/>
        <section id="new-site" className="portal-panel">
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
              {listing.paymentIncidents.length>0&&<p className="portal-hold">Payment hold · {listing.paymentIncidents.map(event=>event.split('.').at(-1)?.toLowerCase()).join(', ')}</p>}
              {listing.state==='published'&&<a href={'/equipment/'+listing.id}>View live listing</a>}</div>
            </article>;
          })}
        </section>
      </>}
    </main>
  </div>;
}
