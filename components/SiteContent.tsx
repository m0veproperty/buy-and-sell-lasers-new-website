'use client';

import {useState} from 'react';
import {ExternalLink,Search} from 'lucide-react';
import type {SiteContent as Content,SiteEntry} from '@/backend/site-content';

export default function SiteContent({content,view}:{content:Content;view:'pages'|'posts'}){
  const [search,setSearch]=useState('');
  const [group,setGroup]=useState('');
  const entries=content[view];
  const groups=[...new Set(entries.map(entry=>entry.group))];
  const query=search.trim().toLowerCase();
  const matches=entries.filter(entry=>(!group||entry.group===group)&&(!query||`${entry.title} ${entry.path} ${entry.detail??''}`.toLowerCase().includes(query)));
  return <section className="portal-panel portal-content">
    <div className="portal-panel-title"><div><h2>{view==='pages'?'Website pages':'Posts'}</h2>
      <p>{view==='pages'?'Pages and live listings currently registered on this site.':'Published guides and articles on this site.'}</p></div>
      <small role="status">{matches.length} of {entries.length}</small>
    </div>
    <div className="portal-content-filters">
      <label>Search {view}<span><Search size={16}/><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Title or URL"/></span></label>
      <label>Section<select value={group} onChange={event=>setGroup(event.target.value)}><option value="">All sections</option>{groups.map(value=><option key={value} value={value}>{value}</option>)}</select></label>
    </div>
    {!matches.length&&<p>No {view} match these filters.</p>}
    <div className="portal-content-list">{matches.map((entry:SiteEntry)=><article className="portal-content-row" key={entry.path}>
      <div><span className="portal-content-group">{entry.group}</span><h3>{entry.title}</h3>{entry.detail&&<p>{entry.detail}</p>}<small>{entry.path}</small></div>
      <a href={entry.path} target="_blank" rel="noopener noreferrer" aria-label={`Open ${entry.title} in a new tab`}>View page <ExternalLink size={15}/></a>
    </article>)}</div>
  </section>;
}
