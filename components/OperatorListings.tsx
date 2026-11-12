'use client';

import {useEffect,useState} from 'react';
import {PageIntro} from './SiteShell';
import type {Machine} from '@/backend/service';

type PublishedListing = {
  id:string;
  data:Machine;
  sellerEmail:string;
  photos:string[];
  flags:string[];
};

const endpoint='/api/marketplace/operator/listings';

export default function OperatorListings(){
  const [listings,setListings]=useState<PublishedListing[]|null>(null);
  const [error,setError]=useState('');

  async function load(){
    const response=await fetch(endpoint,{cache:'no-store'});
    const result=await response.json();
    if(!response.ok)throw new Error(result.error);
    setListings(result.listings);
  }

  useEffect(()=>{void load().catch(error=>setError(error.message));},[]);

  return <>
    <PageIntro label="Operator portal" title="Live listings" description="Inspect published listings and authenticity flags."/>
    <section className="account-page page-width">
      {error&&<p className="account-alert" role="alert">{error} <a href="/account">Seller sign-in</a></p>}
      {listings===null&&!error&&<p role="status">Loading listings…</p>}
      {listings?.length===0&&<p>No paid listings are live.</p>}
      {listings?.map(listing=><article className="account-editor" key={listing.id}>
        <h2>{listing.data.make} {listing.data.model}</h2>
        <p>{listing.data.year} · {listing.data.category} · {listing.data.location} · £{listing.data.askingPrice}</p>
        <p>Seller email {listing.sellerEmail}</p>
        {listing.flags.length>0&&<ul>{listing.flags.map(flag=><li key={flag}>{flag}</li>)}</ul>}
        <dl>
          <dt>Condition</dt><dd>{listing.data.condition}</dd>
          <dt>Accessories</dt><dd>{listing.data.accessories||'Unspecified'}</dd>
          <dt>Service and ownership history</dt><dd>{listing.data.history||'Unspecified'}</dd>
        </dl>
        <div className="account-photo-grid">{listing.photos.map((id,index)=><a key={id} href={'/api/marketplace/photos/'+id}>
          <img src={'/api/marketplace/photos/'+id} alt={`Equipment photo ${index+1}`} width={200} height={180} loading="lazy"/>
        </a>)}</div>
        <a href={'/equipment/'+listing.id}>View live listing</a>
      </article>)}
    </section>
  </>;
}
