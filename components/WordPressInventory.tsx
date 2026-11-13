'use client';

import {useState,type FormEvent} from 'react';
import type {Classification,WordPressMachine} from '@/backend/operator-inventory';
import {listings} from '@/lib/listings';

type Inventory = {capturedAt:string;machines:WordPressMachine[]};
const labels:Record<Classification,string>={unclassified:'Unclassified',genuine:'Genuine',demo:'Demo / placeholder'};
const sources:Record<string,string>={laser_market_form:'Laser Market form',woocommerce_converted:'Converted WooCommerce product'};

function MachineRow({machine,onSave}:{machine:WordPressMachine;onSave:(classification:Classification,note:string)=>void}){
  const [label,setLabel]=useState(machine.classification);
  const [note,setNote]=useState(machine.note);
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);
  const example=listings.find(listing=>listing.path.split('/').at(-2)===machine.slug);
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
    <td><a href={'https://buyandselllasers.com/wp-admin/post.php?action=edit&post='+machine.id}>{machine.title}</a> <small>#{machine.id}</small>
      {example&&<div><a href={example.path}>New-site catalogue entry</a></div>}</td>
    <td>{machine.status==='publish'?'Published':'Draft'}</td>
    <td>{machine.source?(sources[machine.source]??machine.source):'Unknown'}</td>
    <td>{machine.pluginStatus??"Unknown"} · {machine.paymentStatus??"Unknown"}</td>
    <td>
      <form onSubmit={submit}>
        <label className="field-label">Classification<select value={label} onChange={e=>setLabel(e.target.value as Classification)}>
          {Object.entries(labels).map(([value,name])=><option value={value} key={value}>{name}</option>)}
        </select></label>
        <label className="field-label">Evidence or note<input value={note} maxLength={500} required={label!=='unclassified'} onChange={e=>setNote(e.target.value)}/></label>
        <button className="text-link" disabled={busy||(label===machine.classification&&note===machine.note)}>Save</button>
        {message&&<p role="status">{message}</p>}
      </form>
    </td>
  </tr>;
}

export default function WordPressInventory({inventory}:{inventory:Inventory|null}){
  const [search,setSearch]=useState('');
  const [classification,setClassification]=useState('');
  const [status,setStatus]=useState('');
  const [source,setSource]=useState('');
  const [updates,setUpdates]=useState<Record<number,{classification:Classification;note:string}>>({});
  if(!inventory)return <section className="account-editor"><h2>WordPress inventory</h2><p>The inventory snapshot is unavailable.</p></section>;
  const machines=inventory.machines.map(machine=>({...machine,...updates[machine.id]}));
  const matches=machines.filter(machine=>
    (!classification||machine.classification===classification)&&(!status||machine.status===status)&&
    (!source||machine.source===source)&&(machine.title+' '+machine.id).toLowerCase().includes(search.trim().toLowerCase()));
  return <section className="account-editor">
    <h2>WordPress inventory</h2>
    <p>{inventory.machines.length} machines · Snapshot taken {new Date(inventory.capturedAt).toLocaleDateString('en-GB',{timeZone:'Europe/London'})}</p>
    <p>Laser Market form submissions are classified as genuine. Other WordPress listings are classified as placeholders. Operators can record a correction with an evidence note.</p>
    <div className="catalogue-filters">
      <label><span>Search machines</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Title or WordPress ID"/></label>
      <label><span>Classification</span><select value={classification} onChange={e=>setClassification(e.target.value)}>
        <option value="">All classifications</option>
        {Object.entries(labels).map(([value,name])=><option value={value} key={value}>{name}</option>)}
      </select></label>
      <label><span>WordPress status</span><select value={status} onChange={e=>setStatus(e.target.value)}>
        <option value="">All statuses</option><option value="publish">Published</option><option value="draft">Draft</option>
      </select></label>
      <label><span>Plugin source</span><select value={source} onChange={e=>setSource(e.target.value)}>
        <option value="">All sources</option>
        {Object.entries(sources).map(([value,name])=><option value={value} key={value}>{name}</option>)}
      </select></label>
    </div>
    <p>{machines.filter(machine=>machine.classification==='genuine').length} genuine · {machines.filter(machine=>machine.classification==='demo').length} placeholders</p>
    <p role="status">{matches.length} matching machines</p>
    <div style={{overflowX:'auto'}}>
      <table className="operator-inventory">
        <thead><tr><th scope="col">Machine</th><th scope="col">WordPress status</th><th scope="col">Plugin source</th><th scope="col">Plugin status · payment</th><th scope="col">Classification</th></tr></thead>
        <tbody>{matches.map(machine=><MachineRow key={machine.id} machine={machine} onSave={(classification,note)=>setUpdates(previous=>({...previous,[machine.id]:{classification,note}}))}/>)}</tbody>
      </table>
    </div>
  </section>;
}
