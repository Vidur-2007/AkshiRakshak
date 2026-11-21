import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  buildCloud,
  CAPTIONS,
  captionOpacity,
  sceneAt,
  settleInto,
  smooth,
  type CosmicCloud,
} from '@/lib/cosmic';
import { safeLocalStorage } from '@/lib/safeStorage';
import { useAppStore } from '@/lib/store';

const SEEN_KEY = 'akshi-cosmic-seen';

/**
 * Whether to open the landing with the particle intro: once per browser session, never with
 * reduced motion, in Elder mode, on low-end devices, for recording / tour / simple links, or under
 * browser automation (tests), and only when WebGL is available.
 */
export function shouldPlayCosmic(search = typeof location === 'undefined' ? '' : location.search) {
  if (typeof window === 'undefined') return false;
  try {
    if (sessionStorage.getItem(SEEN_KEY)) return false;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  } catch {
    return false;
  }
  if (navigator.webdriver) return false;
  if (/[?&](demo|simple|start)=/.test(search)) return false;
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl'));
  } catch {
    return false;
  }
}

const SHIELD = 'M100 14l66 26v48c0 44-28 80-66 98-38-18-66-54-66-98V40z';
const EYE = 'M52 100s20-34 48-34 48 34 48 34-20 34-48 34-48-34-48-34z';

/** Sample the shield and eye outlines with the browser's own path geometry. */
function shapeSampler(): (shape: 'shield' | 'eye', t: number) => { x: number; y: number } {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('style', 'position:absolute;width:0;height:0;visibility:hidden');
  document.body.appendChild(svg);
  const mk = (d: string) => {
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', d);
    svg.appendChild(p);
    return { p, len: p.getTotalLength() };
  };
  const shapes = { shield: mk(SHIELD), eye: mk(EYE) };
  const pts: Record<'shield' | 'eye', { x: number; y: number }[]> = { shield: [], eye: [] };
  for (const k of ['shield', 'eye'] as const) {
    for (let i = 0; i <= 600; i++) {
      const pt = shapes[k].p.getPointAtLength((i / 600) * shapes[k].len);
      pts[k].push({ x: pt.x, y: pt.y });
    }
  }
  svg.remove();
  return (shape, t) => pts[shape][Math.min(600, Math.floor(t * 600))]!;
}

const VERT = `
attribute vec3 aA; attribute vec3 aB; attribute float aKind; attribute float aSeed;
uniform float uT, uMorph, uRed, uPush, uFade, uPix, uF, uAspect; uniform vec2 uRot; uniform vec3 uCam;
varying vec3 vC; varying float vA; varying float vHub;
void main(){
  vec3 a = aA + 0.55*vec3(sin(uT*.6+aSeed*6.), cos(uT*.5+aSeed*4.), sin(uT*.4+aSeed*9.));
  float trap = step(1.5, aKind);
  float hub = step(0.5, aKind) * (1.0 - trap);
  vec3 p;
  if (trap > .5) { p = a + normalize(aA + .001) * uPush * 46.; }
  else {
    float m = clamp(uMorph*1.5 - aSeed*.5, 0., 1.); m = m*m*(3.-2.*m);
    p = mix(a, aB + .06*vec3(sin(uT*1.3+aSeed*20.), cos(uT+aSeed*13.), 0.), m);
  }
  float cy = cos(uRot.y), sy = sin(uRot.y), cx = cos(uRot.x), sx = sin(uRot.x);
  vec3 r = vec3(p.x*cy + p.z*sy, p.y, -p.x*sy + p.z*cy);
  r = vec3(r.x, r.y*cx - r.z*sx, r.y*sx + r.z*cx);
  float zc = uCam.z - r.z;
  gl_Position = zc < .5 ? vec4(2., 2., 2., 1.) : vec4((r.x - uCam.x)*uF/uAspect, (r.y - uCam.y)*uF, 0., zc);
  float size = hub > .5 ? 19.*(1.-uMorph*.75) : (trap > .5 ? 3.2*(1.+uRed*2.2) : mix(5.2, 3.9, uMorph));
  gl_PointSize = size * uPix * (30. / max(zc, .5));
  vec3 dust = mix(vec3(.15,.62,1.), vec3(.24,.88,1.), uMorph);
  vec3 hubC = mix(vec3(.69,.30,1.), vec3(.24,.88,1.), uMorph);
  vec3 trapC = mix(vec3(.55,.66,.95), vec3(1.,.22,.36), uRed);
  vC = trap > .5 ? trapC : (hub > .5 ? hubC : dust);
  vA = uFade * (trap > .5 ? (1.-uPush)*(.6+uRed*.4) : (hub > .5 ? .95 : .62+uMorph*.3));
  vHub = hub;
}`;

const FRAG = `
precision mediump float; varying vec3 vC; varying float vA; varying float vHub;
void main(){
  float d = length(gl_PointCoord - .5);
  float soft = smoothstep(.5, 0., d);
  float a = vHub > .5 ? soft*soft*.55 + exp(-d*d*90.)*.9 : soft*soft;
  gl_FragColor = vec4(vC + vHub*exp(-d*d*120.)*.6, a * vA);
}`;

interface Gl {
  gl: WebGLRenderingContext;
  u: Record<string, WebGLUniformLocation | null>;
  count: number;
  /** free the program and buffers; the context itself stays usable (StrictMode re-runs effects) */
  dispose(): void;
}

function setupGl(canvas: HTMLCanvasElement, cloud: CosmicCloud): Gl | null {
  const gl = canvas.getContext('webgl', {
    antialias: false,
    alpha: false,
    premultipliedAlpha: false,
  });
  if (!gl) return null;
  const sh = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
  };
  const vs = sh(gl.VERTEX_SHADER, VERT);
  const fs = sh(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return null;
  const prog = gl.createProgram()!;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);
  const bufs: (WebGLBuffer | null)[] = [];
  const attr = (name: string, data: Float32Array, size: number) => {
    const buf = gl.createBuffer();
    bufs.push(buf);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, name);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
  };
  attr('aA', cloud.start, 3);
  attr('aB', cloud.target, 3);
  attr('aKind', cloud.kind, 1);
  attr('aSeed', cloud.seed, 1);
  const u: Gl['u'] = {};
  for (const n of [
    'uT',
    'uMorph',
    'uRed',
    'uPush',
    'uFade',
    'uPix',
    'uF',
    'uAspect',
    'uRot',
    'uCam',
  ])
    u[n] = gl.getUniformLocation(prog, n);
  gl.disable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE); // additive: overlapping light glows, like the design
  gl.clearColor(5 / 255, 6 / 255, 7 / 255, 1);
  const dispose = () => {
    bufs.forEach((b) => gl.deleteBuffer(b));
    gl.deleteProgram(prog);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
  };
  return { gl, u, count: cloud.count, dispose };
}

/**
 * The landing's opening (design 2026-11-20): messages flood in as a cosmic web of light, a few
 * turn red ("traps"), are pushed away, and the rest settle into Akshi's shield-eye — driven by
 * scrolling. Skip, Esc or reaching the end hands over to the landing page.
 */
export function CosmicIntro({ onDone }: { onDone(): void }) {
  const { t } = useTranslation();
  const tier = useAppStore((s) => s.deviceTier);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const capRefs = useRef<(HTMLDivElement | null)[]>([]);
  const barRef = useRef<HTMLElement>(null);
  const seqRef = useRef<HTMLSpanElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef(false);
  const [leaving, setLeaving] = useState(false);

  const finish = useCallback(
    (fast: boolean) => {
      if (doneRef.current) return;
      doneRef.current = true;
      try {
        sessionStorage.setItem(SEEN_KEY, '1');
      } catch {
        /* private mode: the intro may play again next time, which is harmless */
      }
      safeLocalStorage.setItem('akshi-intro-seen', '1'); // the short AKSHI loader is not needed now
      setLeaving(true);
      window.setTimeout(onDone, fast ? 250 : 520);
    },
    [onDone],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = scrollRef.current;
    if (!canvas || !wrap) return;
    const mobile = window.innerWidth < 760;
    const cloud = buildCloud(tier === 'high' && !mobile ? 9000 : mobile ? 3200 : 5500);
    settleInto(cloud, shapeSampler());
    const g = setupGl(canvas, cloud);
    if (!g) {
      finish(true);
      return;
    }
    const dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2);
    const resize = () => {
      canvas.width = Math.round(window.innerWidth * dpr);
      canvas.height = Math.round(window.innerHeight * dpr);
      g.gl.viewport(0, 0, canvas.width, canvas.height);
    };
    resize();
    window.addEventListener('resize', resize);
    let mx = 0;
    let my = 0;
    const onMove = (e: PointerEvent) => {
      mx = e.clientX / window.innerWidth - 0.5;
      my = e.clientY / window.innerHeight - 0.5;
    };
    if (!mobile) window.addEventListener('pointermove', onMove);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish(true);
    };
    window.addEventListener('keydown', onKey);

    wrap.focus({ preventScroll: true }); // arrow keys and Page Down scroll the intro at once
    const t0 = performance.now();
    let last = t0;
    let spin = 0;
    let sp = 0;
    let raf = 0;
    const f = 1 / Math.tan((27.5 * Math.PI) / 180);
    const loop = (now: number) => {
      if (doneRef.current && !rootRef.current) return;
      const time = (now - t0) / 1000;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const lim = Math.max(1, wrap.scrollHeight - wrap.clientHeight);
      sp += (wrap.scrollTop / lim - sp) * 0.12;
      const p = Math.min(1, Math.max(0, sp));
      const s = sceneAt(p);
      const fade = smooth(0, 0.6, time); // straight in: a quick fade, no loading screen
      spin += dt * (0.05 + (1 - s.morph) * 0.06);
      const ry = (1 - s.morph) * (spin + p * 2.6);
      const rx = (1 - s.morph) * 0.18 * Math.sin(time * 0.2);
      const camx = mx * 2.2 * (1 - s.morph * 0.6);
      const camy = -my * 1.6 * (1 - s.morph * 0.6);
      const { gl, u } = g;
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(u.uT!, time);
      gl.uniform1f(u.uMorph!, s.morph);
      gl.uniform1f(u.uRed!, s.red);
      gl.uniform1f(u.uPush!, s.push);
      gl.uniform1f(u.uFade!, fade);
      gl.uniform1f(u.uPix!, dpr);
      gl.uniform1f(u.uF!, f);
      gl.uniform1f(u.uAspect!, canvas.width / canvas.height);
      gl.uniform2f(u.uRot!, rx, ry);
      gl.uniform3f(u.uCam!, camx, camy, s.camZ);
      gl.drawArrays(gl.POINTS, 0, g.count);
      CAPTIONS.forEach((w, i) => {
        const el = capRefs.current[i];
        if (!el) return;
        const o = captionOpacity(p, w);
        el.style.opacity = String(o);
        el.style.transform = `translate(-50%, calc(-50% + ${(1 - o) * 24 * (p < (w[0] + w[1]) / 2 ? 1 : -1)}px))`;
      });
      if (hintRef.current) hintRef.current.style.opacity = String(1 - smooth(0, 0.04, p));
      if (barRef.current) barRef.current.style.width = `${p * 100}%`;
      if (seqRef.current)
        seqRef.current.textContent = `${String(Math.round(p * 100)).padStart(3, '0')}%`;
      if (endRef.current) endRef.current.style.opacity = String(smooth(0.88, 0.98, p));
      if (p > 0.985) finish(false);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('keydown', onKey);
      g.dispose();
    };
  }, [finish, tier]);

  return (
    <div
      ref={rootRef}
      className="cosmic-intro"
      data-leaving={leaving ? 'yes' : 'no'}
      role="dialog"
      aria-modal="true"
      aria-label={t('intro.label')}
    >
      <canvas ref={canvasRef} className="cosmic-canvas" aria-hidden />
      <div ref={scrollRef} className="cosmic-scroll" tabIndex={0}>
        <div className="cosmic-track" />
      </div>
      <div className="cosmic-hud top">
        <span>
          <span className="dot" aria-hidden />
          {t('intro.hud')}
        </span>
        <button type="button" className="cosmic-skip" onClick={() => finish(true)}>
          {t('intro.skip')}
        </button>
      </div>
      {(
        [
          ['c1', null],
          ['c2', 'c2Em'],
          ['c3', 'c3Em'],
        ] as const
      ).map(([k, em], i) => (
        <div
          key={k}
          ref={(el) => {
            capRefs.current[i] = el;
          }}
          className={`cosmic-cap ${k}`}
        >
          <p>
            {t(`intro.${k}`)}
            {em && (
              <>
                {' '}
                <em>{t(`intro.${em}`)}</em>
              </>
            )}
          </p>
          <span>{t(`intro.${k}Sub`)}</span>
        </div>
      ))}
      <div ref={hintRef} className="cosmic-hint" aria-hidden>
        <span>{t('intro.hint')}</span>
        <i />
      </div>
      <div className="cosmic-bar" aria-hidden>
        <i ref={barRef} />
      </div>
      <div className="cosmic-hud bot" aria-hidden>
        <span ref={seqRef}>000%</span>
        <span>{t('intro.drag')}</span>
      </div>
      <div ref={endRef} className="cosmic-end" aria-hidden />
    </div>
  );
}
