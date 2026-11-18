/**
 * ShieldCore (§5.1, M12.1): a rotating point sphere drawn with Canvas 2D (the human
 * chose this over three.js). It is the one element allowed to idle in a loop (§3.3).
 * Loaded lazily after the landing page paints; low tier and reduced motion get the
 * static poster instead.
 */
import { useReducedMotion } from 'motion/react';
import { useEffect, useRef } from 'react';
import { TIER_SETTINGS } from '@/lib/deviceTier';
import type { Verdict } from '@/lib/engine';
import {
  crossedThreshold,
  fibonacciSphere,
  mixHex,
  project,
  rotate,
  SHIELD_COLORS,
  SHIELD_POINTS,
  type Vec3,
} from '@/lib/shieldMath';
import { useAppStore } from '@/lib/store';
import { ShieldPoster } from './ShieldPoster';

const VERDICT_HEX: Record<Verdict, string> = {
  scam: SHIELD_COLORS.scam,
  suspicious: SHIELD_COLORS.warn,
  no_signs: SHIELD_COLORS.safe,
};

interface Particle {
  angle: number;
  t0: number;
}
interface Ring {
  t0: number;
  color: string;
}

const PARTICLE_MS = 900;
const RING_MS = 1300;
const SETTLE_MS = 700;
const BUCKETS = 6;

export interface ShieldCoreProps {
  /** live risk 0–100, or null before typing */
  score: number | null;
  /** typed characters so far; each new one spawns a particle */
  charCount: number;
  /** set on Scan: the core settles into the verdict colour */
  settle: Verdict | null;
  className?: string;
}

export default function ShieldCore(props: ShieldCoreProps) {
  const tier = useAppStore((s) => s.deviceTier);
  const elder = useAppStore((s) => s.elderMode);
  const reduced = useReducedMotion() ?? false;
  if (SHIELD_POINTS[tier] === 0 || reduced || elder)
    return <ShieldPoster className={props.className} settle={props.settle} />;
  return (
    <ShieldCanvas {...props} points={SHIELD_POINTS[tier]} dprCap={TIER_SETTINGS[tier].dprCap} />
  );
}

function ShieldCanvas({
  score,
  charCount,
  settle,
  className,
  points,
  dprCap,
}: ShieldCoreProps & { points: number; dprCap: number }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Props reach the render loop through refs, so the loop never restarts.
  const state = useRef({
    pts: [] as Vec3[],
    particles: [] as Particle[],
    rings: [] as Ring[],
    lastScore: 0,
    lastChars: 0,
    settle: null as Verdict | null,
    settleT0: 0,
    tiltX: 0,
    tiltY: 0,
    targetX: 0,
    targetY: 0,
    yaw: 0,
    visible: true,
  });

  useEffect(() => {
    state.current.pts = fibonacciSphere(points);
  }, [points]);

  // Typed characters → particles drifting in (capped per update)
  useEffect(() => {
    const s = state.current;
    const added = Math.min(6, Math.max(0, charCount - s.lastChars));
    const now = performance.now();
    for (let i = 0; i < added; i++)
      s.particles.push({ angle: Math.random() * Math.PI * 2, t0: now + i * 40 });
    s.lastChars = charCount;
  }, [charCount]);

  // Crossing 40 / 70 → an amber / red ring travels across the sphere
  useEffect(() => {
    const s = state.current;
    const next = score ?? 0;
    const hit = crossedThreshold(s.lastScore, next);
    if (hit)
      s.rings.push({
        t0: performance.now(),
        color: hit === 'scam' ? SHIELD_COLORS.scam : SHIELD_COLORS.warn,
      });
    s.lastScore = next;
  }, [score]);

  useEffect(() => {
    const s = state.current;
    if (settle && s.settle !== settle) {
      s.settle = settle;
      s.settleT0 = performance.now();
    }
    if (!settle) s.settle = null;
  }, [settle]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const s = state.current;
    let raf = 0;
    let w = 0;
    let h = 0;
    let dpr = 1;

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, dprCap);
      w = Math.max(1, Math.round(rect.width));
      h = Math.max(1, Math.round(rect.height));
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    // Pause offscreen and on a hidden tab (§5.1, §7)
    const io = new IntersectionObserver(([e]) => {
      s.visible = !!e?.isIntersecting;
      if (s.visible) start();
    });
    io.observe(wrap);
    const onVis = () => {
      if (!document.hidden) start();
    };
    document.addEventListener('visibilitychange', onVis);

    // Pointer parallax on devices with a fine pointer
    const fine = window.matchMedia?.('(pointer: fine)').matches ?? false;
    const onMove = (e: PointerEvent) => {
      s.targetX = (e.clientX / window.innerWidth - 0.5) * 0.5;
      s.targetY = (e.clientY / window.innerHeight - 0.5) * 0.35;
    };
    if (fine) window.addEventListener('pointermove', onMove, { passive: true });

    const buckets: number[][] = Array.from({ length: BUCKETS }, () => []);

    const frame = (now: number) => {
      raf = 0;
      if (!s.visible || document.hidden) return;
      const cx = w / 2;
      const cy = h / 2;
      const R = Math.min(w, h) * 0.33;
      const settleK = s.settle ? Math.min(1, (now - s.settleT0) / SETTLE_MS) : 0;
      const color = s.settle
        ? mixHex(SHIELD_COLORS.brand, VERDICT_HEX[s.settle], settleK)
        : SHIELD_COLORS.brand;
      s.yaw += 0.0035 * (1 - 0.7 * settleK);
      s.tiltX += (s.targetX - s.tiltX) * 0.05;
      s.tiltY += (s.targetY - s.tiltY) * 0.05;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      // soft glow behind the core (glow is reserved for the shield and the verdict)
      const g = ctx.createRadialGradient(cx, cy, R * 0.1, cx, cy, R * 1.5);
      g.addColorStop(0, `${color}55`);
      g.addColorStop(1, `${color}00`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      for (const b of buckets) b.length = 0;
      for (const p of s.pts) {
        const r = rotate(p, s.yaw + s.tiltX, 0.35 + s.tiltY);
        const q = project(r, cx, cy, R);
        const bucket = Math.min(BUCKETS - 1, Math.floor(q.depth * BUCKETS));
        buckets[bucket]!.push(q.x, q.y, q.scale);
      }
      ctx.fillStyle = color;
      for (let b = 0; b < BUCKETS; b++) {
        const list = buckets[b]!;
        ctx.globalAlpha = 0.12 + (0.8 * (b + 1)) / BUCKETS;
        const size = 0.7 + (1.3 * b) / BUCKETS;
        for (let i = 0; i < list.length; i += 3) {
          const sz = size * list[i + 2]!;
          ctx.fillRect(list[i]! - sz / 2, list[i + 1]! - sz / 2, sz, sz);
        }
      }

      // ring pulses
      s.rings = s.rings.filter((ring) => now - ring.t0 < RING_MS);
      for (const ring of s.rings) {
        const k = (now - ring.t0) / RING_MS;
        ctx.globalAlpha = 0.9 * (1 - k);
        ctx.strokeStyle = ring.color;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.ellipse(cx, cy, R * (0.25 + k), R * (0.25 + k) * 0.38, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      // typed-character particles drift into the core
      s.particles = s.particles.filter((pt) => now - pt.t0 < PARTICLE_MS);
      ctx.fillStyle = color;
      for (const pt of s.particles) {
        const k = Math.max(0, (now - pt.t0) / PARTICLE_MS);
        const ease = 1 - (1 - k) ** 3;
        const dist = R * (1.7 - 1.6 * ease);
        ctx.globalAlpha = 0.9 * (1 - k * 0.6);
        ctx.beginPath();
        ctx.arc(
          cx + Math.cos(pt.angle) * dist,
          cy + Math.sin(pt.angle) * dist * 0.8,
          2.2,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      start();
    };

    function start() {
      if (!raf && s.visible && !document.hidden) raf = requestAnimationFrame(frame);
    }
    start();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      if (fine) window.removeEventListener('pointermove', onMove);
    };
  }, [dprCap]);

  return (
    <div ref={wrapRef} className={className} aria-hidden>
      <canvas ref={canvasRef} className="block size-full" />
    </div>
  );
}
