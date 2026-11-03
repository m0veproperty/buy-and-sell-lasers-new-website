'use client';
import {useEffect,useRef} from 'react';
import type {BufferGeometry} from 'three';

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
   renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
   const keyLight=new T.DirectionalLight(0xffffff,2);keyLight.position.set(-3,7,5);keyLight.castShadow=true;
   keyLight.shadow.mapSize.set(1024,1024);keyLight.shadow.camera.left=-4;keyLight.shadow.camera.right=4;keyLight.shadow.camera.top=4;keyLight.shadow.camera.bottom=-4;keyLight.shadow.normalBias=.035;keyLight.shadow.radius=4;scene.add(keyLight);
   const floor=new T.Mesh(new T.PlaneGeometry(20,20),new T.ShadowMaterial({color:0x25436a,opacity:.18}));floor.rotation.x=-Math.PI/2;floor.position.y=-2.19;floor.receiveShadow=true;scene.add(floor);
   const shadowCanvas=document.createElement('canvas');shadowCanvas.width=128;shadowCanvas.height=128;
   const ctx=shadowCanvas.getContext('2d')!;const gradient=ctx.createRadialGradient(64,64,5,64,64,64);gradient.addColorStop(0,'rgba(22,49,83,0.25)');gradient.addColorStop(.5,'rgba(22,49,83,0.12)');gradient.addColorStop(1,'rgba(22,49,83,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);
   const shadowTexture=new T.CanvasTexture(shadowCanvas);const contact=new T.Mesh(new T.PlaneGeometry(3.8,3.1),new T.MeshBasicMaterial({map:shadowTexture,transparent:true,depthWrite:false}));contact.rotation.x=-Math.PI/2;contact.position.y=-2.185;scene.add(contact);
   const shell=new T.MeshBasicMaterial({color:0x3879bd,wireframe:true,transparent:true,opacity:.14,depthWrite:false});
   const blue=new T.MeshBasicMaterial({color:0x246bd0,wireframe:true,transparent:true,opacity:.38,depthWrite:false});
   const navy=new T.MeshBasicMaterial({color:0x183d6b,wireframe:true,transparent:true,opacity:.3,depthWrite:false});
   const lineMaterial=new T.LineBasicMaterial({color:0x2b659d,transparent:true,opacity:.65});
   const enamel=new T.MeshStandardMaterial({color:0xe6f4ff,metalness:.2,roughness:.55,transparent:true,opacity:.15,depthWrite:false});
   const detail=new T.MeshBasicMaterial({color:0x3577b5,transparent:true,opacity:.35,wireframe:true,depthWrite:false});
   const part=(geometry:BufferGeometry,material:InstanceType<typeof T.Material>,parent:InstanceType<typeof T.Group>=model)=>{const mesh=new T.Mesh(geometry,material);mesh.castShadow=true;parent.add(mesh);const edges=new T.LineSegments(new T.EdgesGeometry(geometry,30),lineMaterial);mesh.add(edges);return mesh;};
   const box=(w:number,h:number,d:number,x:number,y:number,z:number,mat:InstanceType<typeof T.Material>=shell,r=.08,parent:InstanceType<typeof T.Group>=model)=>{const mesh=part(new RoundedBoxGeometry(w,h,d,3,r),mat,parent);mesh.position.set(x,y,z);return mesh;};
   const tube=(points:number[][],radius:number,mat:InstanceType<typeof T.Material>=navy)=>{const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p as [number,number,number])));const mesh=part(new T.TubeGeometry(curve,64,radius,8,false),mat);return mesh;};
   // Tall rounded diode-laser cabinet, with a shallow tilted touchscreen.
   box(1.25,3.04,1.03,0,-.18,0,shell,.17);
   box(1.24,3.03,1.02,0,-.18,0,enamel,.17);
   for(const x of [-.52,.52])box(.018,2.75,.018,x,-.18,.51,detail,.004);
   box(1.04,.11,.12,0,.88,.57,blue,.05);
   box(.38,.12,.3,0,1.37,-.08,navy,.04);
   const head=new T.Group();head.position.set(0,1.72,-.03);head.rotation.x=-.36;model.add(head);
   box(1.4,.93,.13,0,0,0,navy,.07,head);
   box(1.23,.75,.025,0,0,.08,shell,.035,head);
   const ring=part(new T.TorusGeometry(.14,.009,6,36),blue,head);ring.position.set(-.3,.02,.1);
   for(let i=0;i<4;i++)box(.4-i*.04,.014,.012,.24,.13-i*.085,.1,blue,.003,head);
   // Body panel seams, cooling slots and a front handpiece socket.
   for(let i=0;i<15;i++)for(const x of [-.29,-.1,.1,.29])box(.075,.018,.012,x,-.77-i*.043,.521,detail,.003);
   for(let i=0;i<16;i++)box(.012,.018,.48,.631,-.62+i*.06,0,detail,.003);
   box(.24,.38,.09,-.26,.15,.56,navy,.06);
   box(.13,.035,.07,0,1.34,.45,blue,.01);
   // Four swept outriggers and swivel castors, rather than a solid trolley plinth.
   for(const x of [-1,1])for(const z of [-1,1]){
    tube([[x*.42,-1.65,z*.32],[x*.64,-1.74,z*.48],[x*.8,-1.8,z*.65]],.07,shell);
    const fork=box(.18,.21,.17,x*.8,-1.91,z*.65,navy,.03);
    const wheel=part(new T.CylinderGeometry(.16,.16,.11,20,1),navy);wheel.rotation.z=Math.PI/2;wheel.position.set(x*.8,-2.02,z*.65);
    const hub=part(new T.CylinderGeometry(.075,.075,.12,16),blue);hub.rotation.z=Math.PI/2;hub.position.copy(wheel.position);
   }
   const handpiece=(x:number,y:number,z:number)=>{const group=new T.Group();group.position.set(x,y,z);model.add(group);box(.14,.48,.16,0,0,0,shell,.04,group);box(.26,.26,.26,0,.32,.045,navy,.055,group);box(.17,.15,.018,0,.33,.185,blue,.025,group);box(.2,.08,.22,0,-.25,0,blue,.025,group);return group;};
   handpiece(.82,1.04,.1);handpiece(-.26,.05,.73);
   box(.25,.065,.29,.73,.97,.1,blue,.025);
   tube([[.82,.77,.1],[.99,.15,.15],[1.05,-1.66,.65],[.6,-2.12,1.05],[-.1,-2.03,1.08],[-.36,-1.24,.86],[-.26,-.2,.73]],.052);
   tube([[.58,.2,-.18],[.87,-.2,-.15],[.91,-.8,.03],[.86,.1,.18],[.82,.77,.1]],.026,detail);
   // Diagnostic internals appear more strongly as the cabinet opens on scroll.
   const internals=new T.Group();model.add(internals);
   for(let i=0;i<4;i++){box(.88,.035,.68,0,-1.14+i*.53,0,detail,.01,internals);for(let j=0;j<3;j++)box(.17,.08,.2,-.25+j*.25,-1.08+i*.53,.05,blue,.015,internals);}
   for(let i=0;i<12;i++)box(.72,.018,.44,0,-.64+i*.035,-.1,detail,.003,internals);
   for(const x of [-.42,.42])box(.035,2.5,.035,x,-.2,-.35,blue,.008,internals);
   const scan=new T.Mesh(new T.TorusGeometry(1.2,.008,6,80),blue);scan.rotation.x=Math.PI/2;scene.add(scan);
   const originals=model.children.map(child=>child.position.clone());
   el.appendChild(renderer.domElement);el.dataset.status='ready';
   let raf=0,lastTime=0,idleTime=0,inView=true;const reduced=matchMedia('(prefers-reduced-motion: reduce)');
   const render=()=>{if(stopped)return;renderer.render(scene,camera);el.dataset.angle=model.rotation.y.toFixed(2);};
   const resize=()=>{const w=el.clientWidth,h=el.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/Math.max(h,1);camera.updateProjectionMatrix();render();};
   const setProgress=(p:number)=>{
    const turn=Math.min(1,Math.max(0,(p-.18)/.72));
    model.rotation.y=-.45+turn*Math.PI*1.65+(reduced.matches?0:Math.sin(idleTime*.28)*.65*Math.max(0,1-p/.35));
    enamel.opacity=.15*(1-Math.min(1,Math.max(0,(p-.08)/.38)));
    internals.visible=p>.12;
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
   cleanup=()=>{cancelAnimationFrame(raf);observer.disconnect();visibility.disconnect();reduced.removeEventListener('change',preference);document.removeEventListener('visibilitychange',resume);control.current=null;scene.traverse(o=>{if(o instanceof T.Mesh||o instanceof T.LineSegments){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});shadowTexture.dispose();renderer.dispose();renderer.domElement.remove();};
  }).catch(()=>{el.dataset.status='fallback';});
  return()=>{stopped=true;cleanup();};
 },[]);
 return <div className="sculpture wire-sculpture"><div className="sculpture-canvas" ref={host} role="img" aria-label="Scroll-controlled detailed wireframe laser machine with optical coils, circuit boards, cooling modules and handpiece" data-status="loading"><svg className="sculpture-fallback" viewBox="0 0 500 600" aria-hidden="true"><g fill="none" stroke="#4378b5" strokeWidth="1.5"><rect x="170" y="205" width="160" height="280" rx="30"/><rect x="155" y="140" width="190" height="130" rx="23"/><rect x="171" y="158" width="158" height="90" rx="12"/><path d="M330 260C440 270 440 510 363 470S390 330 390 300M180 310H320M180 340H320M180 370H320M180 400H320M180 430H320M200 270V480M230 270V480M260 270V480M290 270V480"/><rect x="148" y="480" width="204" height="26" rx="10"/></g></svg></div></div>;
}
