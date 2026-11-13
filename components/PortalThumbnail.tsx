'use client';

import {ImageIcon} from 'lucide-react';
import {useState} from 'react';

export default function PortalThumbnail({src}:{src?:string|null}){
  const [failed,setFailed]=useState(false);
  return <span className="portal-thumb" aria-hidden="true">
    {src&&!failed?<img src={src} alt="" width={64} height={54} loading="lazy" onError={()=>setFailed(true)}/>:<ImageIcon size={19}/>}
  </span>;
}
