'use client';

import {useEffect,useState} from 'react';
import WordPressInventory from './WordPressInventory';
import type {WordPressMachine} from '@/backend/operator-inventory';
import {PageIntro} from './SiteShell';
import type {Machine} from '@/backend/service';

type OperatorListing = {
  id:string;
  data:Machine;
  state:string;
  paymentIncidents:string[];
  sellerEmail:string;
  photos:string[];
  flags:string[];
};

const endpoint='/api/marketplace/operator/listings';

export default function OperatorListings(){
  const [listings,setListings]=useState<OperatorListing[]|null>(null);
  const [wordpress,setWordPress]=useState<{capturedAt:string;machines:WordPressMachine[]}|null>(null);
  const [error,setError]=useState('');

  async function load(){
    const response=await fetch(endpoint,{cache:'no-store'});
    const result=await response.json();
    if(!response.ok)throw new Error(result.error);
    setListings(result.listings);
    setWordPress(result.wordpress);
  }

  useEffect(()=>{void load().catch(error=>setError(error.message));},[]);

  return <>
    <PageIntro label="Operator portal" title="Machine inventory" description="Check listing provenance and manage marketplace follow-up."/>
    <section className="account-page page-width">
      {error&&<p className="account-alert" role="alert">{error} <a href="/account">Seller sign-in</a></p>}
      {listings===null&&!error&&<p role="status">Loading listings…</p>}
      {listings&&<><WordPressInventory inventory={wordpress}/><h2>New-site listings</h2></>}
      {listings?.length===0&&<p>No listings are live or on payment hold.</p>}
      {listings?.map(listing=><article className="account-editor" key={listing.id}>
        <h2>{listing.data.make} {listing.data.model}</h2>
        <p>{listing.data.year} · {listing.data.category} · {listing.data.location} · £{listing.data.askingPrice}</p>
        <p>Seller email {listing.sellerEmail}</p>
        {listing.paymentIncidents.length>0&&<p className="account-alert">Listing withdrawn after a PayPal payment incident. {listing.paymentIncidents.map(event=>({
          'PAYMENT.CAPTURE.REFUNDED':'Refund',
          'PAYMENT.CAPTURE.REVERSED':'Reversal',
          'CUSTOMER.DISPUTE.CREATED':'Dispute'
        })[event]??'Payment incident').join(', ')}.</p>}
        {listing.flags.length>0&&<ul>{listing.flags.map(flag=><li key={flag}>{flag}</li>)}</ul>}
        <dl>
          <dt>Condition</dt><dd>{listing.data.condition}</dd>
          <dt>Accessories</dt><dd>{listing.data.accessories||'Unspecified'}</dd>
          <dt>Service and ownership history</dt><dd>{listing.data.history||'Unspecified'}</dd>
        </dl>
        <div className="account-photo-grid">{listing.photos.map((id,index)=><a key={id} href={'/api/marketplace/photos/'+id}>
          <img src={'/api/marketplace/photos/'+id} alt={`Equipment photo ${index+1}`} width={200} height={180} loading="lazy"/>
        </a>)}</div>
        {listing.state==='published'&&<a href={'/equipment/'+listing.id}>View live listing</a>}
      </article>)}
    </section>
  </>;
}
