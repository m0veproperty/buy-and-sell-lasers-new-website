'use client';
import {useEffect,useRef,useState} from 'react';

export default function LaserSculpture(){
 const host=useRef<HTMLDivElement>(null);
 const control=useRef<((angle:number)=>void)|null>(null);
 const [view,setView]=useState(0);
 useEffect(()=>{
  const el=host.current;if(!el)return;
  let stopped=false,cleanup=()=>{};
  import('three').then(async T=>{
   const {RoundedBoxGeometry}=await import('three/examples/jsm/geometries/RoundedBoxGeometry.js');
   if(stopped)return;
   let renderer:InstanceType<typeof T.WebGLRenderer>;
   try{renderer=new T.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power',preserveDrawingBuffer:true});}catch{el.dataset.status='fallback';return;}
   renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setClearColor(0,0);
   renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
   const scene=new T.Scene();const camera=new T.PerspectiveCamera(33,1,.1,100);camera.position.set(5,3.5,8);camera.lookAt(0,.2,0);
   const model=new T.Group();scene.add(model);
   scene.add(new T.HemisphereLight(0xe7f2ff,0x334471,3));
   for(const [x,y,z,power,color] of [[-4,6,5,65,0xffffff],[5,2,-3,85,0x4d8dff],[-3,1,-4,45,0x8be9ff]]){const light=new T.PointLight(color,power);light.position.set(x,y,z);scene.add(light);}
   const shell=new T.MeshPhysicalMaterial({color:0xe8eef7,metalness:.55,roughness:.24,clearcoat:1});
   const navy=new T.MeshStandardMaterial({color:0x07152f,metalness:.7,roughness:.3});
   const blue=new T.MeshStandardMaterial({color:0x1875ff,emissive:0x1465ff,emissiveIntensity:2,metalness:.2,roughness:.25});
   const steel=new T.MeshStandardMaterial({color:0x61738c,metalness:.9,roughness:.25});
   const glass=new T.MeshPhysicalMaterial({color:0x102c51,metalness:.65,roughness:.12,clearcoat:1});
   const box=(w:number,h:number,d:number,x:number,y:number,z:number,mat:InstanceType<typeof T.Material>,r=.1)=>{const mesh=new T.Mesh(new RoundedBoxGeometry(w,h,d,4,r),mat);mesh.position.set(x,y,z);model.add(mesh);return mesh;};
   box(1.5,2.1,1.12,0,-.15,0,shell,.2);
   box(1.52,.11,1.14,0,-.57,0,blue,.04);
   box(1.27,.65,1.05,0,-1.4,.04,navy,.13);
   box(1.9,.2,1.55,0,-1.8,0,shell,.08);
   for(const x of [-.7,.7])for(const z of [-.53,.53]){const wheel=new T.Mesh(new T.CylinderGeometry(.17,.17,.13,24),navy);wheel.rotation.z=Math.PI/2;wheel.position.set(x,-1.99,z);model.add(wheel);}
   const head=new T.Group();head.position.set(0,1.2,0);head.rotation.x=-.18;model.add(head);
   const housing=new T.Mesh(new RoundedBoxGeometry(1.7,.95,1,5,.17),shell);head.add(housing);
   const screen=new T.Mesh(new RoundedBoxGeometry(1.39,.66,.05,3,.07),glass);screen.position.set(0,.02,.51);head.add(screen);
   // Abstract display geometry, intentionally not a real manufacturer's interface.
   const ring=new T.Mesh(new T.TorusGeometry(.19,.012,8,64),blue);ring.position.set(-.3,.02,.55);head.add(ring);
   for(let i=0;i<5;i++){const line=new T.Mesh(new T.BoxGeometry(.4-i*.035,.018,.015),blue);line.position.set(.28,.15-i*.075,.55);head.add(line);}
   for(let i=0;i<8;i++)box(.42,.018,.025,0,-.82-i*.047,.57,steel,.005);
   const hosePath=new T.CatmullRomCurve3([new T.Vector3(.75,.65,0),new T.Vector3(1.25,.5,.1),new T.Vector3(1.65,-.8,.28),new T.Vector3(1.4,-1.35,.65),new T.Vector3(1.1,-.65,.95),new T.Vector3(1.32,.35,.85)]);
   model.add(new T.Mesh(new T.TubeGeometry(hosePath,70,.065,12,false),navy));
   const handpiece=new T.Group();handpiece.position.set(1.32,.48,.85);handpiece.rotation.z=-.28;model.add(handpiece);
   const handle=new T.Mesh(new T.CylinderGeometry(.1,.13,.5,24),shell);handpiece.add(handle);
   const tip=new T.Mesh(new T.CylinderGeometry(.08,.1,.13,24),blue);tip.position.y=.31;handpiece.add(tip);
   const beam=new T.Mesh(new T.CylinderGeometry(.018,.045,.95,24,1,true),new T.MeshBasicMaterial({color:0x4faaff,transparent:true,opacity:.25,depthWrite:false}));beam.position.y=.87;handpiece.add(beam);
   const platform=new T.Mesh(new T.CylinderGeometry(1.85,1.9,.075,96),new T.MeshStandardMaterial({color:0xd5e3f6,metalness:.7,roughness:.25}));platform.position.y=-2.2;scene.add(platform);
   const baseRing=new T.Mesh(new T.TorusGeometry(1.8,.014,8,96),blue);baseRing.rotation.x=Math.PI/2;baseRing.position.y=-2.15;scene.add(baseRing);
   el.appendChild(renderer.domElement);el.dataset.status='ready';
   let raf=0;const reduced=matchMedia('(prefers-reduced-motion: reduce)');
   const render=()=>{if(stopped)return;renderer.render(scene,camera);el.dataset.angle=model.rotation.y.toFixed(2);};
   const resize=()=>{const w=el.clientWidth,h=el.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/Math.max(h,1);camera.updateProjectionMatrix();render();};
   const animateTo=(angle:number,duration=600)=>{cancelAnimationFrame(raf);const from=model.rotation.y,start=performance.now();const frame=()=>{const t=reduced.matches?1:Math.min(1,(performance.now()-start)/duration);model.rotation.y=from+(angle-from)*(1-Math.pow(1-t,3));render();if(t<1)raf=requestAnimationFrame(frame);};frame();};
   control.current=a=>animateTo(a);model.rotation.y=reduced.matches?-.28:-.9;
   const observer=new ResizeObserver(resize);observer.observe(el);resize();animateTo(-.28,1800);
   cleanup=()=>{cancelAnimationFrame(raf);observer.disconnect();control.current=null;scene.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});renderer.dispose();renderer.domElement.remove();};
  }).catch(()=>{el.dataset.status='fallback';});
  return()=>{stopped=true;cleanup();};
 },[]);
 return <div className="sculpture"><div className="sculpture-canvas" ref={host} role="img" aria-label="Abstract pearl-white laser machine with blue light accents, a touchscreen and handpiece" data-status="loading"><svg className="sculpture-fallback" viewBox="0 0 500 600" aria-hidden="true"><defs><linearGradient id="shell"><stop stopColor="#fff"/><stop offset="1" stopColor="#a6bbd8"/></linearGradient></defs><ellipse cx="250" cy="530" rx="160" ry="25" fill="#c7d9ee"/><rect x="170" y="205" width="160" height="280" rx="30" fill="url(#shell)"/><rect x="155" y="140" width="190" height="130" rx="23" fill="url(#shell)"/><rect x="171" y="158" width="158" height="90" rx="12" fill="#102d51"/><circle cx="220" cy="201" r="24" fill="none" stroke="#4c9fff" strokeWidth="4"/><path d="M330 260C440 270 440 510 363 470S390 330 390 300" fill="none" stroke="#183454" strokeWidth="15"/><path d="M178 350H322" stroke="#3384ff" strokeWidth="9"/><rect x="148" y="480" width="204" height="26" rx="10" fill="#5a7499"/></svg></div><div className="sculpture-controls" aria-label="Machine viewpoint">{['Front view','Side view','Rear view'].map((label,i)=><button key={label} aria-pressed={view===i} onClick={()=>{setView(i);control.current?.([-.28,1.15,2.8][i]);}}>{label}</button>)}</div></div>;
}
