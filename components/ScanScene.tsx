'use client';
import {useEffect,useRef} from 'react';
type Props={focus:number;progress:number};
export default function ScanScene({focus,progress}:Props){
 const host=useRef<HTMLDivElement>(null);
 const draw=useRef<((focus:number,progress:number)=>void)|null>(null);
 const latest=useRef({focus,progress}); latest.current={focus,progress};
 useEffect(()=>{
  const container=host.current;if(!container||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  let cancelled=false,dispose=()=>{};
  import('three').then(async THREE=>{
   if(cancelled)return;
   let renderer:InstanceType<typeof THREE.WebGLRenderer>;
   try{renderer=new THREE.WebGLRenderer({alpha:true,antialias:false,powerPreference:'low-power',preserveDrawingBuffer:true});}catch{container.dataset.status='fallback';return;}
   renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setClearColor(0x000000,0);
   const scene=new THREE.Scene();const camera=new THREE.OrthographicCamera(-.75,.75,1,-1,.1,10);camera.position.z=3;
   const loader=new THREE.TextureLoader();
   let texture:InstanceType<typeof THREE.Texture>,mask:InstanceType<typeof THREE.Texture>;
   try{[texture,mask]=await Promise.all([loader.loadAsync('/images/aw3-main.webp'),loader.loadAsync('/images/aw3-mask.svg')]);}catch{renderer.dispose();container.dataset.status='fallback';return;}
   if(cancelled){texture.dispose();mask.dispose();renderer.dispose();return;}
   texture.colorSpace=THREE.SRGBColorSpace;
   const uniforms={uPhoto:{value:texture},uMask:{value:mask},uReveal:{value:0},uProgress:{value:0},uFocus:{value:new THREE.Vector2(.48,.72)},uFocusOn:{value:0},uPixel:{value:renderer.getPixelRatio()}};
   const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms,
    vertexShader:`varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`uniform sampler2D uPhoto;uniform sampler2D uMask;uniform float uReveal;uniform float uProgress;uniform vec2 uFocus;uniform float uFocusOn;varying vec2 vUv;
     void main(){float mask=texture2D(uMask,vUv).a;if(mask<.02)discard;vec4 c=texture2D(uPhoto,vUv);float scan=smoothstep(vUv.y-.12,vUv.y+.12,uReveal*1.25);float edge=1.-smoothstep(.0,.018,abs(vUv.y-uReveal*1.25));float d=distance(vUv,uFocus);float ring=1.-smoothstep(.003,.009,abs(d-.135));vec3 rgb=mix(c.rgb*.92,vec3(.72,.91,.32),edge*.6);rgb=mix(rgb,vec3(.75,.94,.36),ring*uFocusOn*.7);gl_FragColor=vec4(rgb,mask*scan);}`});
   const plane=new THREE.Mesh(new THREE.PlaneGeometry(1.5,2),material);scene.add(plane);
   const cols=125,rows=167,positions=new Float32Array(cols*rows*3),uvs=new Float32Array(cols*rows*2),seeds=new Float32Array(cols*rows);
   for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){const i=y*cols+x;positions[i*3]=(x/(cols-1)-.5)*1.5;positions[i*3+1]=(y/(rows-1)-.5)*2;positions[i*3+2]=.03;uvs[i*2]=x/(cols-1);uvs[i*2+1]=y/(rows-1);seeds[i]=Math.sin(i*127.1)*.5+.5;}
   const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.BufferAttribute(uvs,2));geometry.setAttribute('aSeed',new THREE.BufferAttribute(seeds,1));
   const particlesMat=new THREE.ShaderMaterial({uniforms,transparent:true,depthWrite:false,
    vertexShader:`uniform float uReveal;uniform float uPixel;attribute float aSeed;varying vec2 vUv;varying float vAlpha;void main(){vUv=uv;vec3 p=position;float spread=pow(1.-uReveal,2.);p.x+=sin(aSeed*28.+position.y*5.)*spread*.9;p.y+=cos(aSeed*15.)*spread*.35;p.z+=spread*aSeed;vAlpha=1.-smoothstep(.65,1.,uReveal);gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);gl_PointSize=(1.3+aSeed)*uPixel;}`,
    fragmentShader:`uniform sampler2D uMask;uniform sampler2D uPhoto;varying vec2 vUv;varying float vAlpha;void main(){float a=texture2D(uMask,vUv).a;if(a<.5||length(gl_PointCoord-.5)>.5)discard;vec3 c=texture2D(uPhoto,vUv).rgb;gl_FragColor=vec4(mix(c,vec3(.23,.31,.16),.45),vAlpha*.8);}`});
   const cloud=new THREE.Points(geometry,particlesMat);scene.add(cloud);
   container.appendChild(renderer.domElement);container.dataset.status='ready';
   const stats={status:'ready',frames:0,renderMs:[] as number[],elapsedMs:0,points:cols*rows};(window as unknown as {__bslScene:unknown}).__bslScene=stats;
   let raf=0;const started=performance.now();let intersecting=true;
   const render=()=>{const t=performance.now();renderer.render(scene,camera);stats.renderMs.push(performance.now()-t);stats.frames++;container.dataset.reveal=uniforms.uReveal.value.toFixed(2);container.dataset.draws=String(renderer.info.render.calls);container.dataset.renderMs=(performance.now()-t).toFixed(2);container.dataset.frames=String(stats.frames);};
   const resize=()=>{renderer.setSize(container.clientWidth,container.clientHeight,false);render();};
   const observer=new ResizeObserver(resize);observer.observe(container);
   const visibility=new IntersectionObserver(([entry])=>{intersecting=entry.isIntersecting;if(intersecting)render();});visibility.observe(container);
   const animate=()=>{if(cancelled)return;const t=Math.min(1,(performance.now()-started)/2400);uniforms.uReveal.value=t;stats.elapsedMs=performance.now()-started;if(intersecting&&!document.hidden)render();if(t<1)raf=requestAnimationFrame(animate);};
   draw.current=(f,p)=>{uniforms.uProgress.value=p;uniforms.uFocus.value.set(...([[.48,.72],[.79,.56],[.48,.28]][f]??[.48,.72]) as [number,number]);uniforms.uFocusOn.value=f<0?0:1;if(intersecting)render();};
   const interruption=()=>{if(scrollY>150){cancelAnimationFrame(raf);uniforms.uReveal.value=1;render();}};
   addEventListener('scroll',interruption,{passive:true});resize();animate();
   dispose=()=>{cancelAnimationFrame(raf);observer.disconnect();visibility.disconnect();removeEventListener('scroll',interruption);geometry.dispose();particlesMat.dispose();plane.geometry.dispose();material.dispose();texture.dispose();mask.dispose();renderer.dispose();renderer.domElement.remove();draw.current=null;};
  }).catch(()=>{if(container)container.dataset.status='fallback';});
  return()=>{cancelled=true;dispose();};
 },[]);
 useEffect(()=>{draw.current?.(focus,progress);},[focus,progress]);
 return <div ref={host} className="scan-canvas" aria-hidden="true" data-status="loading"/>;
}
