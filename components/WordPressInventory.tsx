'use client';

import {useState,type FormEvent} from 'react';
import {ExternalLink, Search} from 'lucide-react';
import type {Classification,WordPressMachine} from '@/backend/operator-inventory';
import {listings} from '@/lib/listings';
import PortalThumbnail from './PortalThumbnail';

type Inventory = {capturedAt:string;machines:WordPressMachine[]};
const labels:Record<Classification,string>={unclassified:'Unclassified',genuine:'Genuine',demo:'Placeholder'};
const sources:Record<string,string>={laser_market_form:'Laser Market form',woocommerce_converted:'WooCommerce conversion'};

function MachineRow({machine,onSave}:{machine:WordPressMachine;onSave:(classification:Classification,note:string)=>void}){
  const [label,setLabel]=useState(machine.classification);
  const [note,setNote]=useState(machine.note);
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);
  const example=listings.find(listing=>listing.path.split('/').at(-2)===machine.slug);
  const contact=machine.contact;
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try{
      const response=await fetch('/api/marketplace/operator/wordpress/'+machine.id,{
        method:'PATCH',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({classification:label,note})
      });
      const result=await response.json();
      if(!response.ok)throw new Error(result.error);
      onSave(result.classification,result.note);
      setMessage('Saved.');
    }catch(error){
      setMessage(error instanceof Error?error.message:'Could not save the classification.');
    }finally{
      setBusy(false);
    }
  }

  return <tr>
    <td><div className="portal-machine">
      <PortalThumbnail src={machine.image||(example&&'/images/'+example.image+'-small.webp')}/>
      <div><strong>{machine.title}</strong><small>#{machine.id} · {machine.source?(sources[machine.source]??machine.source):'Unknown source'}</small></div>
    </div></td>
    <td><span className={'portal-badge '+machine.classification}>{labels[machine.classification]}</span></td>
    <td><span className={'portal-badge '+machine.status}>{machine.status==='publish'?'Published':'Draft'}</span></td>
    <td>{machine.classification==='genuine'&&contact?<>{contact.name&&<strong>{contact.name}</strong>}
      {contact.email&&<a className="portal-contact" href={'mailto:'+contact.email}>{contact.email}</a>}
      {contact.phone&&<a className="portal-contact" href={'tel:'+contact.phone}>{contact.phone}</a>}
      {!contact.name&&!contact.email&&!contact.phone&&<small>Unavailable</small>}</>:<small>—</small>}</td>
    <td>{machine.classification==='genuine'&&contact?<>{contact.durationDays===null?'—':contact.durationDays+' days'}
      {contact.package&&<small className="portal-contact">{contact.package}</small>}
      {contact.expires&&<small className="portal-contact">Ends {contact.expires}</small>}</>:<small>—</small>}</td>
    <td><details><summary>Details</summary>
      <p>Plugin status · {machine.pluginStatus??'Unknown'}<br/>Payment status · {machine.paymentStatus??'Unknown'}</p>
      <p><a href={'https://buyandselllasers.com/wp-admin/post.php?action=edit&post='+machine.id}>Open in WordPress <ExternalLink size={13}/></a></p>
      {example&&<p><a href={example.path}>New-site catalogue entry</a></p>}
      <form onSubmit={submit}>
        <label>Classification<select value={label} onChange={e=>setLabel(e.target.value as Classification)}>
          {Object.entries(labels).map(([value,name])=><option value={value} key={value}>{name}</option>)}
        </select></label>
        <label>Evidence or note<textarea rows={3} value={note} maxLength={500} required={label!=='unclassified'} onChange={e=>setNote(e.target.value)}/></label>
        <button disabled={busy||(label===machine.classification&&note===machine.note)}>Save</button>
        {message&&<p role="status">{message}</p>}
      </form>
    </details></td>
  </tr>;
}

export default function WordPressInventory({inventory}:{inventory:Inventory|null}){
  const [search,setSearch]=useState('');
  const [classification,setClassification]=useState('');
  const [status,setStatus]=useState('');
  const [source,setSource]=useState('');
  const [updates,setUpdates]=useState<Record<number,{classification:Classification;note:string}>>({});
  if(!inventory)return <section className="portal-panel"><h2>WordPress inventory</h2><p>The inventory snapshot is unavailable.</p></section>;
  const machines=inventory.machines.map(machine=>({...machine,...updates[machine.id]}));
  const matches=machines.filter(machine=>
    (!classification||machine.classification===classification)&&(!status||machine.status===status)&&
    (!source||machine.source===source)&&(machine.title+' '+machine.id).toLowerCase().includes(search.trim().toLowerCase()));
  return <>
    <div className="portal-stats">{[
      ['WordPress machines',machines.length],['Genuine',machines.filter(machine=>machine.classification==='genuine').length],
      ['Placeholders',machines.filter(machine=>machine.classification==='demo').length],
      ['Published',machines.filter(machine=>machine.status==='publish').length]
    ].map(([label,value])=><div key={label}><small>{label}</small><strong>{value}</strong></div>)}</div>
    <section className="portal-panel">
      <div className="portal-panel-title"><div><h2>WordPress listings</h2><p>Snapshot from {new Date(inventory.capturedAt).toLocaleDateString('en-GB',{timeZone:'Europe/London'})}</p></div><small role="status">{matches.length} matching machines</small></div>
      <div className="portal-filters">
        <label>Search machines<span><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Machine name or ID"/></span></label>
        <label>Classification<select value={classification} onChange={e=>setClassification(e.target.value)}>
          <option value="">All classifications</option>
          {Object.entries(labels).map(([value,name])=><option value={value} key={value}>{name}</option>)}
        </select></label>
        <label>Status<select value={status} onChange={e=>setStatus(e.target.value)}>
          <option value="">All statuses</option><option value="publish">Published</option><option value="draft">Draft</option>
        </select></label>
        <label>Source<select value={source} onChange={e=>setSource(e.target.value)}>
          <option value="">All sources</option>
          {Object.entries(sources).map(([value,name])=><option value={value} key={value}>{name}</option>)}
        </select></label>
      </div>
      {!matches.length&&<p>No machines match these filters.</p>}
      <div className="portal-table-wrap">
        <table className="portal-table">
          <thead><tr>{['Machine','Classification','Status','Seller contact','Listing period','Actions'].map(label=><th key={label} scope="col">{label}</th>)}</tr></thead>
          <tbody>{matches.map(machine=><MachineRow key={machine.id} machine={machine} onSave={(classification,note)=>setUpdates(previous=>({...previous,[machine.id]:{classification,note}}))}/>)}</tbody>
        </table>
      </div>
    </section>
  </>;
}
