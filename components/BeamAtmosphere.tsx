'use client';

import {useEffect, useRef} from 'react';

/** Decorative light trails. Loaded near the viewport, paused offscreen, with a CSS fallback. */
export default function BeamAtmosphere({tone = 'light'}: {tone?: 'light' | 'dark'}) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const target = host.current;
    if (!target) return;
    const element: HTMLDivElement = target;
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
          uTime: {value: 0}, uDark: {value: tone === 'dark' ? 1 : 0},
          uResolution: {value: new T.Vector2(1, 1)},
        };
        const material = new T.ShaderMaterial({
          transparent: true, depthWrite: false, uniforms,
          vertexShader: 'void main(){gl_Position=vec4(position,1.0);}',
          fragmentShader: `
            precision mediump float;
            uniform float uTime;
            uniform float uDark;
            uniform vec2 uResolution;
            float trail(float x, float lane) {
              return .22 + .11 * sin(x * 5.2 + uTime * .16 + lane * .12)
                + .07 * cos(x * 8.0 - uTime * .1) + lane * .016;
            }
            void main() {
              vec2 uv = gl_FragCoord.xy / uResolution;
              float aspect = uResolution.x / uResolution.y;
              float glow = 0.0;
              float beams = 0.0;
              for (int i = 0; i < 7; i++) {
                float lane = float(i) - 3.0;
                float y = trail(uv.x, lane);
                float d = abs(uv.y - y);
                beams += exp(-d * 650.0) * .33 + exp(-d * 70.0) * .035;
                float x = fract(uTime * (.025 + float(i) * .003) + float(i) * .151);
                vec2 point = vec2((uv.x - x) * aspect, uv.y - trail(x, lane));
                glow += exp(-length(point) * 220.0) * .8;
              }
              float halo = exp(-abs(uv.y - trail(uv.x, 0.0)) * 15.0) * .09;
              vec3 blue = mix(vec3(.035,.29,.90), vec3(.18,.55,1.0), uv.x);
              vec3 cyan = mix(vec3(.18,.46,1.0), vec3(.30,.88,1.0), uv.x);
              vec3 color = mix(blue, cyan, uDark);
              float fade = smoothstep(0.0,.12,uv.x) * smoothstep(1.0,.84,uv.x);
              float alpha = (beams + glow + halo) * mix(.55,.86,uDark) * fade;
              gl_FragColor = vec4(color, clamp(alpha, 0.0, .8));
            }`,
        });
        const geometry = new T.PlaneGeometry(2, 2);
        scene.add(new T.Mesh(geometry, material));
        element.appendChild(renderer.domElement);
        let previous = 0, elapsed = 0, lost = false;
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
  }, [tone]);

  return <div ref={host} className={`beam-atmosphere beam-atmosphere-${tone}`} aria-hidden="true"><i/><i/><i/></div>;
}
