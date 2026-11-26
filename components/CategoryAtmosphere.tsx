'use client';

import {useEffect, useRef} from 'react';

/** Category-specific light fields, with a fresh phase, scale and direction on every visit. */
export default function CategoryAtmosphere({variant = 0}: {variant?: number}) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const target = host.current;
    if (!target) return;
    const element: HTMLDivElement = target;
    const seed = Math.random() * 100;
    element.dataset.variant = String(variant);
    element.dataset.phase = seed.toFixed(4);
    element.style.setProperty('--field-turn', `${(seed % 16) - 8}deg`);
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let disposed = false, loading = false, visible = false, frame = 0;
    let teardown = () => {}, sync = () => {};

    async function initialise() {
      if (loading || disposed || reduced.matches) return;
      loading = true;
      try {
        const T = await import('three');
        if (disposed || reduced.matches) { loading = false; return; }
        const renderer = new T.WebGLRenderer({alpha: true, antialias: false, powerPreference: 'low-power'});
        renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 768 ? 1 : 1.5));
        const scene = new T.Scene();
        const camera = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        const uniforms = {
          uTime: {value: seed}, uVariant: {value: variant}, uSeed: {value: seed},
          uResolution: {value: new T.Vector2(1, 1)},
        };
        const material = new T.ShaderMaterial({
          transparent: true, depthWrite: false, uniforms,
          vertexShader: 'void main(){gl_Position=vec4(position,1.0);}',
          fragmentShader: `
            precision mediump float;
            uniform float uTime;
            uniform float uVariant;
            uniform float uSeed;
            uniform vec2 uResolution;
            void main() {
              vec2 uv = gl_FragCoord.xy / uResolution;
              float aspect = uResolution.x / uResolution.y;
              float t = uTime * (.12 + fract(uSeed) * .06);
              vec2 p = vec2((uv.x - .74) * aspect, uv.y - .48);
              float angle = sin(uSeed) * .24;
              p = mat2(cos(angle),-sin(angle),sin(angle),cos(angle)) * p;
              p *= .92 + fract(uSeed * .31) * .18;
              float field = 0.0;
              for (int i=0; i<8; i++) {
                float lane = float(i);
                float d;
                if (uVariant < .5) {
                  // A sweeping fan of laser filaments.
                  float y = .19 * sin(p.x * 2.7 + t + lane*.075) + (lane-3.5)*.045;
                  d = abs(p.y - y);
                } else if (uVariant < 1.5) {
                  // Elliptical pulse rings radiating around the equipment.
                  float radius = .18 + lane*.07 + .018*sin(t+lane*.5);
                  d = abs(length(p*vec2(.78,1.0))-radius);
                } else if (uVariant < 2.5) {
                  // Tall spectral ribbons with different phases.
                  float x = .18*sin(p.y*3.4+t+lane*.18)+(lane-3.5)*.105;
                  d = abs(p.x-x);
                } else if (uVariant < 3.5) {
                  // Rounded modular contours.
                  vec2 q=abs(p*vec2(.85,1.0));
                  float r=pow(pow(q.x,4.0)+pow(q.y,4.0),.25);
                  d=abs(r-(.16+lane*.065+.016*sin(t+lane*.4)));
                } else {
                  // Broad, sculpted body contours.
                  float y=.22*sin(p.x*2.3+t*.7+lane*.09)+.08*cos(p.x*5.0-t)+(lane-3.5)*.065;
                  d=abs(p.y-y);
                }
                float shimmer=.65+.35*sin(p.x*4.0+p.y*3.0-t*1.6+lane*.65);
                field += exp(-d*440.0)*.30*shimmer + exp(-d*45.0)*.025;
              }
              float halo=exp(-length(p)*2.9)*.075;
              vec3 color=mix(vec3(.08,.32,.95),vec3(.08,.70,.92),smoothstep(.2,.9,uv.x));
              float edge=smoothstep(0.0,.20,uv.y)*(1.0-smoothstep(.87,1.0,uv.y));
              float textSpace=mix(.12,1.0,smoothstep(.28,.65,uv.x));
              gl_FragColor=vec4(color,clamp((field+halo)*edge*textSpace,0.0,.55));
            }`,
        });
        const geometry = new T.PlaneGeometry(2, 2);
        scene.add(new T.Mesh(geometry, material));
        element.appendChild(renderer.domElement);
        let previous = 0, elapsed = seed, lost = false;
        const render = () => { if (!lost) renderer.render(scene, camera); };
        const tick = (now: number) => {
          if (disposed || !visible || document.hidden || reduced.matches || lost) { frame = 0; return; }
          if (now - previous >= 32) {
            elapsed += Math.min((now - previous) / 1000, .05);
            previous = now;
            uniforms.uTime.value = elapsed;
            render();
          }
          frame = requestAnimationFrame(tick);
        };
        sync = () => {
          cancelAnimationFrame(frame); frame = 0;
          element.dataset.motion = reduced.matches ? 'paused' : 'active';
          if (visible && !document.hidden && !reduced.matches && !lost) {
            previous = performance.now(); frame = requestAnimationFrame(tick);
          }
        };
        const resize = () => {
          renderer.setSize(Math.max(1,element.clientWidth), Math.max(1,element.clientHeight), false);
          renderer.getDrawingBufferSize(uniforms.uResolution.value);
          render();
        };
        const observer = new ResizeObserver(resize);
        observer.observe(element);
        const contextLost = (event: Event) => {
          event.preventDefault(); lost = true; element.dataset.ready = 'false'; sync();
        };
        const contextRestored = () => { lost = false; element.dataset.ready = 'true'; resize(); sync(); };
        renderer.domElement.addEventListener('webglcontextlost', contextLost);
        renderer.domElement.addEventListener('webglcontextrestored', contextRestored);
        resize(); element.dataset.ready = 'true'; sync();
        teardown = () => {
          cancelAnimationFrame(frame); observer.disconnect();
          renderer.domElement.removeEventListener('webglcontextlost', contextLost);
          renderer.domElement.removeEventListener('webglcontextrestored', contextRestored);
          geometry.dispose(); material.dispose(); renderer.dispose(); renderer.domElement.remove();
        };
      } catch { element.dataset.ready = 'false'; }
    }

    const visibility = new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
      if (visible) void initialise();
      sync();
    }, {rootMargin: '100px'});
    visibility.observe(element);
    const preference = () => { if (visible) void initialise(); sync(); };
    document.addEventListener('visibilitychange', preference);
    reduced.addEventListener('change', preference);
    return () => {
      disposed = true; visibility.disconnect(); teardown();
      document.removeEventListener('visibilitychange', preference);
      reduced.removeEventListener('change', preference);
    };
  }, [variant]);

  return <div ref={host} className="category-atmosphere" data-variant={variant} aria-hidden="true"><i/><i/><i/></div>;
}
