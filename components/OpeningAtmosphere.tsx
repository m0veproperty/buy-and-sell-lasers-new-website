'use client';
import {useEffect,useRef} from 'react';
export default function OpeningAtmosphere({progress}:{progress:number}){
 const host=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  const el=host.current;if(!el)return;
  const media=matchMedia('(prefers-reduced-motion: reduce)');let frame=0,x=0,y=0;
  const paint=()=>{frame=0;el.style.setProperty('--drift-x',`${x}px`);el.style.setProperty('--drift-y',`${y}px`);};
  const move=(e:PointerEvent)=>{if(media.matches||e.pointerType!=='mouse')return;x=(e.clientX/innerWidth-.5)*18;y=(e.clientY/innerHeight-.5)*12;if(!frame)frame=requestAnimationFrame(paint);};
  const preference=()=>{if(media.matches){x=0;y=0;paint();}};
  const visibility=()=>{el.dataset.visible=String(!document.hidden);};
  visibility();document.addEventListener('visibilitychange',visibility);media.addEventListener('change',preference);addEventListener('pointermove',move,{passive:true});
  return()=>{cancelAnimationFrame(frame);removeEventListener('pointermove',move);document.removeEventListener('visibilitychange',visibility);media.removeEventListener('change',preference);};
 },[]);
 return <div ref={host} className="opening-atmosphere aura-atmosphere" data-active={progress<.3} aria-hidden="true" style={{opacity:Math.max(0,1-progress/.3),'--scroll-shift':`${progress*180}px`} as React.CSSProperties}>
  <div className="aura-parallax"><div className="aura-cloud aura-cloud-left"/><div className="aura-cloud aura-cloud-right"/><div className="aura-cloud aura-cloud-bottom"/><div className="aura-bloom"/></div>
  <svg className="aura-silk" viewBox="0 0 1800 900" preserveAspectRatio="none"><defs><linearGradient id="aura-silk-light" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#ffffff" stopOpacity=".54"/><stop offset="1" stopColor="#e5f1ff" stopOpacity="0"/></linearGradient></defs><g className="aura-ribbon aura-ribbon-one"><path d="M-120 465C220 740 470 710 870 825C1240 930 1570 350 1920 205L1920 295C1540 450 1280 935 855 872C450 810 150 680-120 560Z" fill="url(#aura-silk-light)"/><path d="M-120 488C240 750 460 695 870 830C1260 950 1570 365 1920 228" fill="none" stroke="#fff" strokeOpacity=".32" strokeWidth="1.5"/></g><g className="aura-ribbon aura-ribbon-two"><path d="M-100 600C300 850 610 830 920 880C1260 935 1560 485 1910 340L1910 400C1530 550 1260 970 915 925C600 880 270 900-100 665Z" fill="url(#aura-silk-light)"/></g></svg>
 </div>;
}
