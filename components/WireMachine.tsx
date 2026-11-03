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
   // A clinical trolley exterior dissolves into the diagnostic wireframe on scroll.
   const enamel=new T.MeshStandardMaterial({color:0xe6f0fa,metalness:.32,roughness:.3,transparent:true,opacity:.94});
   const trim=new T.MeshStandardMaterial({color:0x15375e,metalness:.65,roughness:.27});
   const aluminium=new T.MeshStandardMaterial({color:0x8ea9bf,metalness:.8,roughness:.24});
   const rubber=new T.MeshStandardMaterial({color:0x152334,roughness:.8});
   const display=new T.MeshStandardMaterial({color:0x072b50,metalness:.3,roughness:.15,emissive:0x103d68,emissiveIntensity:.25});
   const indicator=new T.MeshStandardMaterial({color:0x35c9ed,emissive:0x159acb,emissiveIntensity:1.2});
   box(1.48,2.08,1.1,0,-.15,0,enamel,.19);
   box(1.26,.62,1.02,0,-1.4,.04,trim,.12);
   box(1.86,.16,1.51,0,-1.8,0,aluminium,.06);
   const face=new T.Mesh(new RoundedBoxGeometry(1.69,.94,.99,5,.16),enamel);head.add(face);
   const lcd=new T.Mesh(new RoundedBoxGeometry(1.39,.66,.035,3,.06),display);lcd.position.set(0,.02,.54);head.add(lcd);
   // Illuminated interface tiles and pulse graph, without clinical treatment claims.
   for(let i=0;i<3;i++){const tile=new T.Mesh(new T.BoxGeometry(.28,.1,.012),indicator);tile.position.set(-.43+i*.43,-.19,.57);head.add(tile);}
   const graphPoints=Array.from({length:32},(_,i)=>new T.Vector3(-.56+i*.036,.1+Math.sin(i*.65)*.075,.575));
   const graph=new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(graphPoints),48,.008,5,false),indicator);head.add(graph);
   const cylinder=(radius:number,length:number,x:number,y:number,z:number,material:InstanceType<typeof T.Material>)=>{const m=new T.Mesh(new T.CylinderGeometry(radius,radius,length,24),material);m.position.set(x,y,z);model.add(m);return m;};
   for(const x of [-.7,.7])for(const z of [-.53,.53]){
    cylinder(.055,.19,x,-1.91,z,aluminium);
    const tyre=cylinder(.172,.14,x,-2,z,rubber);tyre.rotation.z=Math.PI/2;
    const hub=cylinder(.085,.15,x,-2,z,aluminium);hub.rotation.z=Math.PI/2;
   }
   // Front controls, key switch, recessed vents and fasteners.
   const stop=cylinder(.085,.055,.43,.69,.59,new T.MeshStandardMaterial({color:0xb83939,roughness:.45}));stop.rotation.x=Math.PI/2;
   const key=cylinder(.045,.045,.19,.69,.59,aluminium);key.rotation.x=Math.PI/2;
   box(.012,.06,.035,.19,.69,.625,trim,.003);
   for(let i=0;i<10;i++)box(.65,.024,.018,0,-.75-i*.055,.56,trim,.006);
   for(const x of [-.58,.58])for(const y of [-.98,.55]){const screw=cylinder(.022,.018,x,y,.56,aluminium);screw.rotation.x=Math.PI/2;}
   for(let i=0;i<12;i++)box(.025,.52,.018,-.39+i*.071,-.52,-.56,trim,.006);
   // Rear handle and paired service connectors.
   const handlePath=new T.CatmullRomCurve3([new T.Vector3(-.56,.65,-.54),new T.Vector3(-.55,.85,-.76),new T.Vector3(.55,.85,-.76),new T.Vector3(.56,.65,-.54)]);
   model.add(new T.Mesh(new T.TubeGeometry(handlePath,32,.045,10,false),aluminium));
   for(const x of [-.25,.25]){const socket=cylinder(.085,.07,x,-1.1,-.56,aluminium);socket.rotation.x=Math.PI/2;}
   const grip=new T.Mesh(new T.CylinderGeometry(.105,.13,.49,24),enamel);handpiece.add(grip);
   const treatmentHead=new T.Mesh(new RoundedBoxGeometry(.32,.22,.26,3,.045),aluminium);treatmentHead.position.y=.32;handpiece.add(treatmentHead);
   const sapphire=new T.Mesh(new T.BoxGeometry(.23,.025,.17),indicator);sapphire.position.y=.44;handpiece.add(sapphire);
   beam.visible=false;
   // Cooling radiator fins and optical resonator remain visible in the exploded view.
   for(let i=0;i<15;i++)box(.73,.023,.48,0,-.72+i*.035,-.14,aluminium,.004);
   const resonator=cylinder(.105,.85,-.32,.3,0,aluminium);resonator.rotation.z=Math.PI/2;
   const originals=model.children.map(child=>child.position.clone());
   el.appendChild(renderer.domElement);el.dataset.status='ready';
   let raf=0,lastTime=0,idleTime=0,inView=true;const reduced=matchMedia('(prefers-reduced-motion: reduce)');
   const render=()=>{if(stopped)return;renderer.render(scene,camera);el.dataset.angle=model.rotation.y.toFixed(2);};
   const resize=()=>{const w=el.clientWidth,h=el.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/Math.max(h,1);camera.updateProjectionMatrix();render();};
   const setProgress=(p:number)=>{
    const turn=Math.min(1,Math.max(0,(p-.18)/.72));
    model.rotation.y=-.45+turn*Math.PI*1.65+(reduced.matches?0:Math.sin(idleTime*.28)*.65*Math.max(0,1-p/.35));
    enamel.opacity=.94*(1-Math.min(1,Math.max(0,(p-.08)/.38)));
    enamel.depthWrite=enamel.opacity>.8;
    const explode=Math.max(0,Math.min(1,(p-.57)/.3));
    model.children.forEach((child,i)=>{child.position.copy(originals[i]);child.position.y+=Math.sign(originals[i].y)*explode*.48;if(Math.abs(originals[i].x)>.7)child.position.x+=Math.sign(originals[i].x)*explode*.25;});
    model.scale.setScalar(1-explode*.1);scan.position.y=-2.1+turn*4.4;scan.visible=p>.22&&p<.88;render();
   };
   const tick=(time:number)=>{raf=0;if(stopped||reduced.matches||document.hidden||!inView||latest.current>=.35)return;if(lastTime)idleTime+=Math.min(.05,(time-lastTime)/1000);lastTime=time;setProgress(latest.current);raf=requestAnimationFrame(tick);};
   const resume=()=>{lastTime=0;if(!raf&&!reduced.matches&&!document.hidden&&inView&&latest.current<.35)raf=requestAnimationFrame(tick);};
   control.current=(p)=>{setProgress(p);resume();};
   const visibility=new IntersectionObserver(entries=>{inView=entries[0].isIntersecting;if(inView)resume();});visibility.observe(el);
   const preference=()=>{setProgress(latest.current);resume();};
   reduced.addEventListener('change',preference);document.addEventListener('visibilitychange',resume);resume();
   const observer=new ResizeObserver(resize);observer.observe(el);resize();setProgress(latest.current);
   cleanup=()=>{cancelAnimationFrame(raf);observer.disconnect();visibility.disconnect();reduced.removeEventListener('change',preference);document.removeEventListener('visibilitychange',resume);control.current=null;scene.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});renderer.dispose();renderer.domElement.remove();};
  }).catch(()=>{el.dataset.status='fallback';});
  return()=>{stopped=true;cleanup();};
 },[]);
 return <div className="sculpture wire-sculpture"><div className="sculpture-canvas" ref={host} role="img" aria-label="Scroll-controlled detailed wireframe laser machine with optical coils, circuit boards, cooling modules and handpiece" data-status="loading"><svg className="sculpture-fallback" viewBox="0 0 500 600" aria-hidden="true"><g fill="none" stroke="#4378b5" strokeWidth="1.5"><rect x="170" y="205" width="160" height="280" rx="30"/><rect x="155" y="140" width="190" height="130" rx="23"/><rect x="171" y="158" width="158" height="90" rx="12"/><path d="M330 260C440 270 440 510 363 470S390 330 390 300M180 310H320M180 340H320M180 370H320M180 400H320M180 430H320M200 270V480M230 270V480M260 270V480M290 270V480"/><rect x="148" y="480" width="204" height="26" rx="10"/></g></svg></div></div>;
}
