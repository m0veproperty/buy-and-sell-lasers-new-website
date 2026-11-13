'use client';

import {useState,type FormEvent} from 'react';

export default function EquipmentEnquiry({listingId}:{listingId:string}){
  const [message,setMessage]=useState('');
  const [sent,setSent]=useState(false);
  const [busy,setBusy]=useState(false);

  async function send(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try{
      const response=await fetch('/api/marketplace/enquiries/'+listingId,{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify(Object.fromEntries(new FormData(event.currentTarget)))
      });
      const result=await response.json();
      if(!response.ok)throw new Error(result.error);
      setSent(true);
    }catch(error){
      setMessage(error instanceof Error?error.message:'The enquiry could not be saved.');
    }finally{
      setBusy(false);
    }
  }

  if(sent)return <p role="status">Your enquiry was added to the seller’s inbox.</p>;
  return <form className="contact-form" onSubmit={event=>void send(event)}>
    <h2>Ask the seller</h2>
    <label className="field-label">Name<input name="name" required maxLength={120}/></label>
    <label className="field-label">Email<input name="email" type="email" required maxLength={254}/></label>
    <label className="field-label">Message<textarea name="message" required maxLength={5000}/></label>
    {message&&<p role="alert">{message}</p>}
    <button className="action" disabled={busy}>Send enquiry</button>
  </form>;
}
