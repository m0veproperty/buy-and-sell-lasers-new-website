'use client';
import {useEffect,useRef} from 'react';

export default function WireMachine({progress}:{progress:number}){
 const host=useRef<HTMLDivElement>(null);
 const control=useRef<((angle:number)=>void)|null>(null);
 const latest=useRef(progress);latest.current=progress;
 useEffect(()=>{control.current?.(progress);},[progress]);
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
   const scene=new T.Scene();const camera=new T.PerspectiveCamera(33,1,.1,100);camera.position.set(4,2.4,9);camera.lookAt(0,.2,0);
   const model=new T.Group();scene.add(model);
   scene.add(new T.HemisphereLight(0xe7f2ff,0x334471,3));
   for(const [x,y,z,power,color] of [[-4,6,5,65,0xffffff],[5,2,-3,85,0x4d8dff],[-3,1,-4,45,0x8be9ff]]){const light=new T.PointLight(color,power);light.position.set(x,y,z);scene.add(light);}
   const shell=new T.MeshBasicMaterial({color:0x2460af,wireframe:true,transparent:true,opacity:.16,depthWrite:false});
   const navy=new T.MeshBasicMaterial({color:0x113b75,wireframe:true,transparent:true,opacity:.4,depthWrite:false});
   const blue=new T.MeshBasicMaterial({color:0x267cff,wireframe:true,transparent:true,opacity:.65,depthWrite:false});
   const steel=new T.MeshBasicMaterial({color:0x4489c7,wireframe:true,transparent:true,opacity:.4,depthWrite:false});
   const glass=new T.MeshBasicMaterial({color:0x0e4e9f,wireframe:true,transparent:true,opacity:.3,depthWrite:false});
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
   // Interior optical, cooling and power structures give the exploded wireframe depth.
   for(let i=0;i<5;i++){
    const cell=new T.Mesh(new T.CylinderGeometry(.12,.12,1.25,16,8),i%2?blue:steel);cell.rotation.z=Math.PI/2;cell.position.set(0,-.65+i*.26,0);model.add(cell);
   }
   for(const x of [-.57,.57])box(.06,1.85,.06,x,-.15,-.4,navy,.01);
   for(let i=0;i<4;i++){
    box(.93,.04,.73,0,-.9+i*.45,0,steel,.015);
    for(let j=0;j<4;j++)box(.12,.08,.18,-.33+j*.22,-.82+i*.45,.2,blue,.01);
   }
   const coilPoints=Array.from({length:180},(_,i)=>new T.Vector3(Math.cos(i*.25)*.24,-.65+i*.008,Math.sin(i*.25)*.24));
   model.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(coilPoints),180,.012,5,false),blue));
   const scan=new T.Mesh(new T.TorusGeometry(1.35,.009,6,96),blue);scan.rotation.x=Math.PI/2;scene.add(scan);
   const originals=model.children.map(child=>child.position.clone());
   el.appendChild(renderer.domElement);el.dataset.status='ready';
   let raf=0;const reduced=matchMedia('(prefers-reduced-motion: reduce)');
   const render=()=>{if(stopped)return;renderer.render(scene,camera);el.dataset.angle=model.rotation.y.toFixed(2);};
   const resize=()=>{const w=el.clientWidth,h=el.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/Math.max(h,1);camera.updateProjectionMatrix();render();};
   const setProgress=(p:number)=>{
    const turn=Math.min(1,Math.max(0,(p-.18)/.72));
    model.rotation.y=-.45+turn*Math.PI*1.65;
    const explode=Math.max(0,Math.min(1,(p-.57)/.3));
    model.children.forEach((child,i)=>{child.position.copy(originals[i]);child.position.y+=Math.sign(originals[i].y)*explode*.48;if(Math.abs(originals[i].x)>.7)child.position.x+=Math.sign(originals[i].x)*explode*.25;});
    model.scale.setScalar(1-explode*.1);scan.position.y=-2.1+turn*4.4;scan.visible=p>.22&&p<.88;render();
   };
   control.current=setProgress;
   const observer=new ResizeObserver(resize);observer.observe(el);resize();setProgress(latest.current);
   cleanup=()=>{cancelAnimationFrame(raf);observer.disconnect();control.current=null;scene.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});renderer.dispose();renderer.domElement.remove();};
  }).catch(()=>{el.dataset.status='fallback';});
  return()=>{stopped=true;cleanup();};
 },[]);
 return <div className="sculpture wire-sculpture"><div className="sculpture-canvas" ref={host} role="img" aria-label="Scroll-controlled detailed wireframe laser machine with optical coils, circuit boards, cooling modules and handpiece" data-status="loading"><svg className="sculpture-fallback" viewBox="0 0 500 600" aria-hidden="true"><g fill="none" stroke="#4378b5" strokeWidth="1.5"><rect x="170" y="205" width="160" height="280" rx="30"/><rect x="155" y="140" width="190" height="130" rx="23"/><rect x="171" y="158" width="158" height="90" rx="12"/><path d="M330 260C440 270 440 510 363 470S390 330 390 300M180 310H320M180 340H320M180 370H320M180 400H320M180 430H320M200 270V480M230 270V480M260 270V480M290 270V480"/><rect x="148" y="480" width="204" height="26" rx="10"/></g></svg></div></div>;
}
