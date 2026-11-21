/**
 * The Scam network canvas (design "Scam network V2", 2026-11-21): your checks as the shield-eye at
 * the centre, scam campaigns as glowing hexagons around it (red at risk 85+, amber below), the
 * channels they use, and their numbers, UPI IDs and sites beyond. Orbit or Tree layout, pan, wheel
 * zoom, hover and click, and a draggable "scan lens" that magnifies what is under it.
 *
 * Drawn with Canvas 2D, no library. Positions are deterministic (no physics), so the picture is
 * the same every visit and layout changes animate. Reduced motion: no pulses, sparks or scanning
 * line, and nothing eases. The page keeps a keyboard and screen-reader list of every node.
 */
import { useReducedMotion } from 'motion/react';
import { forwardRef, useEffect, useImperativeHandle, useRef, type ReactNode } from 'react';
import { CORE_ID, linkedTo, type NetNode, type ScamNetwork } from '@/lib/scamNetwork';

export type NetLayout = 'orbit' | 'tree';
export interface NetShow {
  camp: boolean;
  chan: boolean;
  det: boolean;
}
export interface ScamNetworkHandle {
  zoomBy(f: number): void;
}

/** Campaigns at this risk and above are drawn red ("Scams only" keeps them); below, amber. */
export const HIGH_RISK = 85;

const CY = '61,224,255';
const RED = '255,59,92';
const AMB = '245,165,36';
const SHIELD = 'M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6l7-3z';
const EYE = 'M8.5 12s1.3-2.5 3.5-2.5 3.5 2.5 3.5 2.5-1.3 2.5-3.5 2.5-3.5-2.5-3.5-2.5z';
const RADIUS: Record<NetNode['kind'], number> = { core: 24, camp: 12, chan: 11, det: 4.2, mine: 3 };
const ORDER: Record<NetNode['kind'], number> = { mine: 0, det: 1, chan: 2, camp: 3, core: 4 };
const riskRGB = (n: NetNode) => ((n.risk ?? 0) >= HIGH_RISK ? RED : AMB);

interface Pos {
  x: number;
  y: number;
  /** 0–1: grows in when a node appears, fades when hidden */
  g: number;
}
interface View {
  x: number;
  y: number;
  k: number;
}

// ── layouts ─────────────────────────────────────────────────────────────────

function layout(net: ScamNetwork, mode: NetLayout): Map<string, { x: number; y: number }> {
  const out = new Map<string, { x: number; y: number }>();
  const camps = net.nodes.filter((n) => n.kind === 'camp');
  const chans = net.nodes.filter((n) => n.kind === 'chan');
  const mine = net.nodes.filter((n) => n.kind === 'mine');
  const detsOf = (c: NetNode) => net.nodes.filter((n) => n.kind === 'det' && n.parent === c.id);
  const campsOf = (h: NetNode) =>
    camps.filter((c) => net.edges.some((e) => e.a === c.id && e.b === h.id));

  if (mode === 'orbit') {
    out.set(CORE_ID, { x: 0, y: 0 });
    camps.forEach((c, k) => {
      const a = -Math.PI / 2 + (k / camps.length) * Math.PI * 2 + (k % 2 ? 0.12 : -0.08);
      const r = 250 + (k % 3) * 60;
      out.set(c.id, { x: Math.cos(a) * r, y: Math.sin(a) * r * 0.82 });
    });
    // each channel sits towards the campaigns that use it, spread so none overlap
    const ang = chans
      .map((h) => {
        let x = 0;
        let y = 0;
        for (const c of campsOf(h)) {
          const p = out.get(c.id)!;
          const a = Math.atan2(p.y, p.x);
          x += Math.cos(a);
          y += Math.sin(a);
        }
        return { h, a: Math.atan2(y, x) };
      })
      .sort((p, q) => p.a - q.a);
    for (let it = 0; it < 60; it++)
      for (let k = 0; k < ang.length; k++) {
        const p = ang[k]!;
        const q = ang[(k + 1) % ang.length]!;
        let d = q.a - p.a;
        if (k === ang.length - 1) d += Math.PI * 2;
        if (ang.length > 1 && d < 1.05) {
          const f = (1.05 - d) / 2;
          p.a -= f;
          q.a += f;
        }
      }
    ang.forEach(({ h, a }, k) => {
      const r = 145 + (k % 2) * 22;
      out.set(h.id, { x: Math.cos(a + 0.35) * r, y: Math.sin(a + 0.35) * r * 0.85 });
    });
    // details fan outwards from their campaign, in rings when there are many
    for (const c of camps) {
      const p = out.get(c.id)!;
      const base = Math.atan2(p.y, p.x);
      let j = 0;
      let ring = 0;
      const dets = detsOf(c);
      while (j < dets.length) {
        const cap = 9 + ring * 4;
        const inRing = dets.slice(j, j + cap);
        const fan = Math.min(2.6, 0.32 * (inRing.length - 1));
        inRing.forEach((d, i) => {
          const a = base + (inRing.length > 1 ? -fan / 2 + (i / (inRing.length - 1)) * fan : 0);
          const r = 62 + ring * 30;
          out.set(d.id, { x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r });
        });
        j += cap;
        ring += 1;
      }
    }
    mine.forEach((m, j) => {
      const a = (j / Math.max(1, mine.length)) * Math.PI * 2 + 0.4;
      const r = 54 + (j % 2) * 16;
      out.set(m.id, { x: Math.cos(a) * r, y: Math.sin(a) * r });
    });
  } else {
    out.set(CORE_ID, { x: 0, y: -320 });
    chans.forEach((h, k) => out.set(h.id, { x: (k - (chans.length - 1) / 2) * 150, y: -190 }));
    camps.forEach((c, k) => {
      const x = (k - (camps.length - 1) / 2) * 120;
      out.set(c.id, { x, y: 0 });
      detsOf(c).forEach((d, j) =>
        out.set(d.id, { x: x + ((j % 3) - 1) * 30, y: 70 + Math.floor(j / 3) * 34 }),
      );
    });
    mine.forEach((m, j) =>
      out.set(m.id, { x: (j - (mine.length - 1) / 2) * 24, y: -262 - (j % 2) * 14 }),
    );
  }
  return out;
}

// ── drawing ─────────────────────────────────────────────────────────────────

function hexPath(cx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  cx.beginPath();
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
    if (k) cx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    else cx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  cx.closePath();
}

function detailPath(
  cx: CanvasRenderingContext2D,
  kind: NetNode['detail'],
  x: number,
  y: number,
  r: number,
) {
  cx.beginPath();
  if (kind === 'phone') cx.arc(x, y, r, 0, Math.PI * 2);
  else if (kind === 'upi') {
    cx.moveTo(x, y - r * 1.25);
    cx.lineTo(x + r * 1.25, y);
    cx.lineTo(x, y + r * 1.25);
    cx.lineTo(x - r * 1.25, y);
    cx.closePath();
  } else cx.rect(x - r * 0.9, y - r * 0.9, r * 1.8, r * 1.8);
}

function channelIcon(cx: CanvasRenderingContext2D, key: string, x: number, y: number, s: number) {
  cx.save();
  cx.translate(x, y);
  cx.scale(s, s);
  cx.strokeStyle = `rgb(${CY})`;
  cx.lineWidth = 1.8 / s;
  cx.lineCap = 'round';
  cx.lineJoin = 'round';
  cx.beginPath();
  if (key === 'call') {
    cx.moveTo(-5, -5);
    cx.quadraticCurveTo(-6, 5, 5, 5);
    cx.moveTo(-5, -5);
    cx.lineTo(-2, -5);
    cx.moveTo(5, 5);
    cx.lineTo(5, 2);
  } else if (key === 'email') {
    cx.rect(-6, -4, 12, 8);
    cx.moveTo(-6, -4);
    cx.lineTo(0, 1);
    cx.lineTo(6, -4);
  } else {
    // a speech bubble: SMS, WhatsApp; Telegram gets a line inside
    cx.moveTo(-6, -4);
    cx.lineTo(6, -4);
    cx.lineTo(6, 3);
    cx.lineTo(-1, 3);
    cx.lineTo(-4, 6);
    cx.lineTo(-4, 3);
    cx.lineTo(-6, 3);
    cx.closePath();
    if (key === 'telegram') {
      cx.moveTo(-3, -1);
      cx.lineTo(3, -1);
    }
    if (key === 'whatsapp') {
      cx.moveTo(-2.5, -0.5);
      cx.lineTo(2.5, -0.5);
    }
  }
  cx.stroke();
  cx.restore();
}

interface Fonts {
  serif: string;
  sans: string;
  mono: string;
}

export const ScamNetworkCanvas = forwardRef<
  ScamNetworkHandle,
  {
    net: ScamNetwork;
    mode: NetLayout;
    show: NetShow;
    riskOnly: boolean;
    lensOn: boolean;
    selected: string | null;
    onSelect: (id: string | null) => void;
    /** name and the small pill under it, for core, campaigns and channels */
    label: (n: NetNode) => { name: string; pill: string };
    /** fly to this node when it changes (Campaign Match's "See it on the network") */
    focusId: string | null;
    ariaLabel: string;
    lensTitle: string;
    /** the floating card for the selected node */
    card: ReactNode;
  }
>(function ScamNetworkCanvas(props, ref) {
  const reduced = useReducedMotion() ?? false;
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  // everything the animation loop reads lives in one ref, so React renders never restart it
  const live = useRef({
    props,
    reduced,
    pos: new Map<string, Pos>(),
    target: new Map<string, { x: number; y: number }>(),
    view: { x: 0, y: 0, k: 1 } as View,
    goal: { x: 0, y: 0, k: 1 } as View,
    size: { w: 0, h: 0, dpr: 1 },
    hover: null as string | null,
    lens: { x: 0, y: 0, r: 96, moved: false },
    fitted: false,
  });
  live.current.props = props;
  live.current.reduced = reduced;

  const vis = (n: NetNode): boolean => {
    const { show, riskOnly, net } = live.current.props;
    if (n.kind === 'core') return true;
    if (n.kind === 'camp' && !show.camp) return false;
    if (n.kind === 'chan' && !show.chan) return false;
    if ((n.kind === 'det' || n.kind === 'mine') && !show.det) return false;
    if (riskOnly) {
      if (n.kind === 'camp') return (n.risk ?? 0) >= HIGH_RISK;
      if (n.kind === 'det') {
        const parent = net.nodes.find((p) => p.id === n.parent);
        return (parent?.risk ?? 0) >= HIGH_RISK;
      }
    }
    return true;
  };

  const fit = () => {
    const L = live.current;
    const { w, h } = L.size;
    if (!w || !h) return;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const n of L.props.net.nodes) {
      if (!vis(n)) continue;
      const p = L.target.get(n.id);
      if (!p) continue;
      x0 = Math.min(x0, p.x);
      x1 = Math.max(x1, p.x);
      y0 = Math.min(y0, p.y);
      y1 = Math.max(y1, p.y);
    }
    if (!Number.isFinite(x0)) return;
    const wide = w >= 900;
    const [l, r, t, b] = wide ? [140, 40, 90, 60] : [12, 12, 12, 12];
    const k = Math.min((w - l - r) / (x1 - x0 + 160), (h - t - b) / (y1 - y0 + 120));
    L.goal = {
      k,
      x: l + (w - l - r) / 2 - ((x0 + x1) / 2) * k,
      y: t + (h - t - b) / 2 - ((y0 + y1) / 2) * k,
    };
    if (!L.fitted || L.reduced) {
      L.view = { ...L.goal };
      L.fitted = true;
    }
  };

  const zoomAt = (f: number, sx: number, sy: number) => {
    const g = live.current.goal;
    const wx = (sx - g.x) / g.k;
    const wy = (sy - g.y) / g.k;
    g.k = Math.max(0.25, Math.min(4, g.k * f));
    g.x = sx - wx * g.k;
    g.y = sy - wy * g.k;
    if (live.current.reduced) live.current.view = { ...g };
  };

  useImperativeHandle(ref, () => ({
    zoomBy: (f) => zoomAt(f, live.current.size.w / 2, live.current.size.h / 2),
  }));

  // layout: new targets when the network or the mode changes; new nodes start at their target
  useEffect(() => {
    const L = live.current;
    L.target = layout(props.net, props.mode);
    for (const [id, t] of L.target) {
      if (!L.pos.has(id)) L.pos.set(id, { x: t.x, y: t.y, g: L.reduced ? 1 : 0 });
    }
    fit();
  }, [props.net, props.mode]);

  // refit when filters change what is visible
  useEffect(() => {
    fit();
  }, [props.show, props.riskOnly]);

  // fly to a node
  useEffect(() => {
    const L = live.current;
    const t = props.focusId ? L.target.get(props.focusId) : undefined;
    if (!t || !L.size.w) return;
    const k = Math.max(L.goal.k * 1.6, 1.3);
    L.goal = { k, x: L.size.w * 0.45 - t.x * k, y: L.size.h / 2 - t.y * k };
    if (L.reduced) L.view = { ...L.goal };
  }, [props.focusId]);

  // size
  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!stage || !canvas) return;
    const ro = new ResizeObserver(() => {
      const r = stage.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const L = live.current;
      L.size = { w: r.width, h: r.height, dpr };
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
      L.lens.r = r.width < 900 ? 62 : 96;
      fit();
    });
    ro.observe(stage);
    return () => ro.disconnect();
  }, []);

  // pointer: pan, drag the lens, hover, click; wheel zoom (not passive, so the page does not scroll)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const L = live.current;
    const local = (e: { clientX: number; clientY: number }) => {
      const r = canvas.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top] as const;
    };
    const radiusOf = (n: NetNode) => RADIUS[n.kind] * Math.max(0.7, Math.min(1.5, L.view.k));
    const pick = (sx: number, sy: number): string | null => {
      let best: string | null = null;
      let bd = Infinity;
      for (const n of L.props.net.nodes) {
        const p = L.pos.get(n.id);
        if (!p || !vis(n) || p.g < 0.5) continue;
        const x = p.x * L.view.k + L.view.x;
        const y = p.y * L.view.k + L.view.y;
        const d = Math.hypot(x - sx, y - sy) - radiusOf(n);
        if (d < 10 && d < bd) {
          bd = d;
          best = n.id;
        }
      }
      return best;
    };
    let drag: {
      sx: number;
      sy: number;
      lx: number;
      ly: number;
      vx: number;
      vy: number;
      lens: boolean;
      moved: boolean;
    } | null = null;
    const down = (e: PointerEvent) => {
      const [sx, sy] = local(e);
      const d = Math.hypot(sx - L.lens.x, sy - L.lens.y);
      drag = {
        sx,
        sy,
        lx: L.lens.x,
        ly: L.lens.y,
        vx: L.goal.x,
        vy: L.goal.y,
        lens: L.props.lensOn && d < L.lens.r && d > L.lens.r - 24,
        moved: false,
      };
      canvas.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      const [sx, sy] = local(e);
      if (drag) {
        const dx = sx - drag.sx;
        const dy = sy - drag.sy;
        if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
        if (drag.lens) {
          L.lens.x = drag.lx + dx;
          L.lens.y = drag.ly + dy;
          L.lens.moved = true;
        } else {
          L.goal.x = drag.vx + dx;
          L.goal.y = drag.vy + dy;
          L.view.x = L.goal.x;
          L.view.y = L.goal.y;
        }
        return;
      }
      L.hover = pick(sx, sy);
      const onRing =
        L.props.lensOn && Math.abs(Math.hypot(sx - L.lens.x, sy - L.lens.y) - L.lens.r + 11) < 12;
      canvas.style.cursor = L.hover ? 'pointer' : onRing ? 'move' : 'grab';
    };
    const up = () => {
      if (drag && !drag.moved) L.props.onSelect(pick(drag.sx, drag.sy));
      drag = null;
    };
    const leave = () => {
      L.hover = null;
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const [sx, sy] = local(e);
      zoomAt(Math.exp(-e.deltaY * 0.0015), sx, sy);
    };
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointerleave', leave);
    canvas.addEventListener('wheel', wheel, { passive: false });
    return () => {
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointerleave', leave);
      canvas.removeEventListener('wheel', wheel);
    };
  }, []);

  // the animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const cx = canvas?.getContext('2d');
    if (!canvas || !cx) return;
    const css = getComputedStyle(document.documentElement);
    const fonts: Fonts = {
      serif: css.getPropertyValue('--font-serif').trim() || 'Georgia, serif',
      sans: css.getPropertyValue('--font-sans').trim() || 'system-ui, sans-serif',
      mono: css.getPropertyValue('--font-mono').trim() || 'monospace',
    };
    const shield = new Path2D(SHIELD);
    const eye = new Path2D(EYE);
    const L = live.current;
    let raf = 0;

    const scene = (t: number, V: View, simple: boolean) => {
      const { net, selected } = L.props;
      const RM = L.reduced;
      const S = (id: string) => {
        const p = L.pos.get(id)!;
        return [p.x * V.k + V.x, p.y * V.k + V.y] as const;
      };
      const focus = selected ?? L.hover;
      const near = focus ? linkedTo(net, focus) : null;
      const byId = new Map(net.nodes.map((n) => [n.id, n]));
      const A = (n: NetNode) => {
        let a = L.pos.get(n.id)?.g ?? 0;
        if (focus && n.id !== focus && !near!.has(n.id) && n.kind !== 'core') a *= 0.2;
        return a;
      };

      for (const e of net.edges) {
        const a = byId.get(e.a);
        const b = byId.get(e.b);
        if (!a || !b || !vis(a) || !vis(b) || !L.pos.has(a.id) || !L.pos.has(b.id)) continue;
        const al = Math.min(A(a), A(b));
        if (al < 0.02) continue;
        const [x1, y1] = S(a.id);
        const [x2, y2] = S(b.id);
        cx.globalAlpha = al;
        cx.shadowBlur = 0;
        if (e.kind === 'found') {
          const g = cx.createLinearGradient(x1, y1, x2, y2);
          g.addColorStop(0, `rgba(${CY},.85)`);
          g.addColorStop(1, `rgba(${riskRGB(b)},.75)`);
          cx.strokeStyle = g;
          cx.lineWidth = 1.8 * Math.min(1.4, V.k);
          cx.shadowColor = `rgba(${CY},.5)`;
          cx.shadowBlur = simple ? 0 : 8;
        } else if (e.kind === 'core') {
          cx.strokeStyle = `rgba(${CY},.16)`;
          cx.lineWidth = 1;
          cx.setLineDash([3, 5]);
        } else if (e.kind === 'channel') {
          cx.strokeStyle = 'rgba(147,161,181,.28)';
          cx.lineWidth = 1;
        } else if (e.kind === 'shared') {
          cx.strokeStyle = `rgba(${RED},.65)`;
          cx.lineWidth = 1.2;
          cx.setLineDash([4, 4]);
          cx.lineDashOffset = RM ? 0 : -t * 10;
        } else if (e.kind === 'mine') {
          cx.strokeStyle = `rgba(${CY},.3)`;
          cx.lineWidth = 0.8;
          cx.setLineDash([2, 3]);
        } else {
          cx.strokeStyle = `rgba(${RED},.22)`;
          cx.lineWidth = 0.9;
        }
        cx.beginPath();
        cx.moveTo(x1, y1);
        cx.lineTo(x2, y2);
        cx.stroke();
        cx.setLineDash([]);
        cx.shadowBlur = 0;
        if (e.kind === 'found' && !RM && !simple) {
          const u = (t * 0.22 + (b.id.length % 7) * 0.13) % 1;
          cx.fillStyle = '#e9fbff';
          cx.beginPath();
          cx.arc(x1 + (x2 - x1) * u, y1 + (y2 - y1) * u, 2, 0, Math.PI * 2);
          cx.fill();
        }
      }
      cx.globalAlpha = 1;

      const order = net.nodes
        .filter((n) => vis(n) && L.pos.has(n.id))
        .sort((a, b) => ORDER[a.kind] - ORDER[b.kind]);
      const sized = (n: NetNode) =>
        RADIUS[n.kind] *
        Math.max(0.7, Math.min(1.5, V.k)) *
        (0.4 + 0.6 * (L.pos.get(n.id)?.g ?? 0));

      for (const n of order) {
        const a = A(n);
        if (a < 0.02) continue;
        const [x, y] = S(n.id);
        const r = sized(n);
        const hot = n.id === L.hover || n.id === selected;
        cx.globalAlpha = a;
        if (n.kind === 'core') {
          if (!RM && !simple)
            for (let k = 0; k < 3; k++) {
              const ph = (t * 0.3 + k / 3) % 1;
              cx.strokeStyle = `rgba(${CY},${0.35 * (1 - ph)})`;
              cx.lineWidth = 1;
              cx.beginPath();
              cx.arc(x, y, r + 6 + ph * 46, 0, Math.PI * 2);
              cx.stroke();
            }
          const g = cx.createRadialGradient(x, y, r * 0.5, x, y, r * 2.6);
          g.addColorStop(0, `rgba(${CY},.28)`);
          g.addColorStop(1, `rgba(${CY},0)`);
          cx.fillStyle = g;
          cx.beginPath();
          cx.arc(x, y, r * 2.6, 0, Math.PI * 2);
          cx.fill();
          cx.fillStyle = '#0b1018';
          cx.beginPath();
          cx.arc(x, y, r, 0, Math.PI * 2);
          cx.fill();
          cx.strokeStyle = `rgba(${CY},.9)`;
          cx.lineWidth = 1.6;
          cx.stroke();
          cx.strokeStyle = `rgba(${CY},.35)`;
          cx.setLineDash([2, 4]);
          cx.beginPath();
          cx.arc(x, y, r + 5, 0, Math.PI * 2);
          cx.stroke();
          cx.setLineDash([]);
          cx.save();
          cx.translate(x - r * 0.62, y - r * 0.62);
          cx.scale((r * 1.24) / 24, (r * 1.24) / 24);
          cx.strokeStyle = `rgb(${CY})`;
          cx.lineWidth = 1.7;
          cx.lineJoin = 'round';
          cx.shadowColor = `rgba(${CY},.8)`;
          cx.shadowBlur = simple ? 0 : 8;
          cx.stroke(shield);
          cx.stroke(eye);
          cx.restore();
        } else if (n.kind === 'camp') {
          const c = riskRGB(n);
          const pulse = RM ? 0.5 : (Math.sin(t * 1.6 + n.key.length) + 1) / 2;
          const rg = r * (3.4 + pulse * 0.8);
          const g = cx.createRadialGradient(x, y, 0, x, y, rg);
          g.addColorStop(0, `rgba(${c},.38)`);
          g.addColorStop(1, `rgba(${c},0)`);
          cx.fillStyle = g;
          cx.beginPath();
          cx.arc(x, y, rg, 0, Math.PI * 2);
          cx.fill();
          cx.fillStyle = `rgb(${c})`;
          hexPath(cx, x, y, r);
          cx.fill();
          cx.fillStyle = '#fff';
          hexPath(cx, x, y, r * 0.36);
          cx.fill();
          if (hot) {
            cx.strokeStyle = `rgba(${c},.9)`;
            cx.lineWidth = 1.5;
            hexPath(cx, x, y, r + 7);
            cx.stroke();
          }
        } else if (n.kind === 'chan') {
          cx.fillStyle = '#111826';
          cx.beginPath();
          cx.arc(x, y, r, 0, Math.PI * 2);
          cx.fill();
          cx.strokeStyle = hot ? `rgb(${CY})` : 'rgba(147,161,181,.6)';
          cx.lineWidth = 1.3;
          cx.stroke();
          channelIcon(cx, n.key, x, y, r / 11);
        } else if (n.kind === 'det') {
          cx.fillStyle = n.blocked ? `rgb(${RED})` : '#b8c6d6';
          detailPath(cx, n.detail, x, y, r);
          cx.fill();
          if (n.blocked) {
            cx.strokeStyle = `rgba(${RED},.55)`;
            cx.lineWidth = 1;
            cx.beginPath();
            cx.arc(x, y, r + 4, 0, Math.PI * 2);
            cx.stroke();
          }
          if (n.mine) {
            cx.strokeStyle = `rgb(${CY})`;
            cx.lineWidth = 1.6;
            cx.beginPath();
            cx.arc(x, y, r + 6, 0, Math.PI * 2);
            cx.stroke();
          }
          if (hot) {
            cx.strokeStyle = '#ffffff';
            cx.lineWidth = 1.4;
            cx.beginPath();
            cx.arc(x, y, r + 9, 0, Math.PI * 2);
            cx.stroke();
          }
        } else {
          cx.fillStyle = n.blocked ? `rgba(${RED},.8)` : `rgba(${CY},.7)`;
          detailPath(cx, n.detail, x, y, r);
          cx.fill();
          if (hot) {
            cx.strokeStyle = '#ffffff';
            cx.lineWidth = 1.2;
            cx.beginPath();
            cx.arc(x, y, r + 6, 0, Math.PI * 2);
            cx.stroke();
          }
        }
        cx.globalAlpha = 1;
      }

      if (simple) return;
      // labels, biggest nodes first; a label that would overlap one already placed is skipped
      const placed: { x: number; y: number; w: number; h: number }[] = [];
      for (const n of [...order].reverse()) {
        const a = A(n);
        if (a < 0.4 || n.kind === 'mine') continue;
        const [x, y] = S(n.id);
        const r = sized(n);
        cx.globalAlpha = a;
        cx.textBaseline = 'middle';
        if (n.kind === 'det') {
          if (V.k < 1.1 && !n.mine) continue; // report counts only when zoomed in
          cx.font = `400 10px ${fonts.mono}`;
          cx.fillStyle = n.blocked ? 'rgba(255,151,168,.9)' : 'rgba(184,198,214,.75)';
          cx.textAlign = 'center';
          cx.fillText(String(n.reports ?? ''), x, y - r - 9);
          cx.globalAlpha = 1;
          continue;
        }
        const { name, pill } = L.props.label(n);
        const nameFont = n.kind === 'core' ? `400 19px ${fonts.serif}` : `500 12.5px ${fonts.sans}`;
        cx.font = nameFont;
        const w1 = cx.measureText(name).width;
        cx.font = `400 10px ${fonts.mono}`;
        const w2 = cx.measureText(pill).width + 14;
        const tx = x + r + (n.kind === 'core' ? 14 : 10);
        const bw = Math.max(w1, w2) + 4;
        const by = y - 14;
        if (
          placed.some((p) => tx < p.x + p.w && tx + bw > p.x && by < p.y + p.h && by + 32 > p.y)
        ) {
          cx.globalAlpha = 1;
          continue;
        }
        placed.push({ x: tx, y: by, w: bw, h: 32 });
        cx.textAlign = 'left';
        cx.font = nameFont;
        cx.fillStyle = '#e8eef6';
        cx.fillText(name, tx, y - 6);
        cx.font = `400 10px ${fonts.mono}`;
        const pc = n.kind === 'camp' ? riskRGB(n) : CY;
        cx.fillStyle = `rgba(${pc},.14)`;
        cx.beginPath();
        if (cx.roundRect) cx.roundRect(tx, y + 4, w2, 16, 8);
        else cx.rect(tx, y + 4, w2, 16);
        cx.fill();
        cx.fillStyle =
          n.kind === 'camp' ? ((n.risk ?? 0) >= HIGH_RISK ? '#ff97a8' : '#f5b547') : '#8beeff';
        cx.fillText(pill, tx + 7, y + 12.5);
        cx.globalAlpha = 1;
      }
    };

    const frame = (now: number) => {
      const t = now / 1000;
      const RM = L.reduced;
      const s = RM ? 1 : 0.12;
      L.view.x += (L.goal.x - L.view.x) * s;
      L.view.y += (L.goal.y - L.view.y) * s;
      L.view.k += (L.goal.k - L.view.k) * s;
      const ease = RM ? 1 : 0.08;
      for (const n of L.props.net.nodes) {
        const p = L.pos.get(n.id);
        const tg = L.target.get(n.id);
        if (!p || !tg) continue;
        p.x += (tg.x - p.x) * ease;
        p.y += (tg.y - p.y) * ease;
        p.g += ((vis(n) ? 1 : 0) - p.g) * ease;
      }
      const { w, h, dpr } = L.size;
      cx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cx.clearRect(0, 0, w, h);
      if (w && h) {
        scene(t, L.view, false);
        drawLens(t);
        placeCard();
      }
      raf = requestAnimationFrame(frame);
    };

    const screenOf = (id: string) => {
      const p = L.pos.get(id);
      return p ? ([p.x * L.view.k + L.view.x, p.y * L.view.k + L.view.y] as const) : null;
    };

    const drawLens = (t: number) => {
      if (!L.props.lensOn) return;
      const { net } = L.props;
      const camps = net.nodes.filter((n) => n.kind === 'camp' && vis(n));
      // until it is dragged, the lens sits on the riskiest campaign
      if (!L.lens.moved && camps.length) {
        const top = [...camps].sort(
          (a, b) => (b.risk ?? 0) - (a.risk ?? 0) || (b.found ?? 0) - (a.found ?? 0),
        )[0]!;
        const s = screenOf(top.id);
        if (s) [L.lens.x, L.lens.y] = s;
      }
      const { x: lx, y: ly, r: Lr } = L.lens;
      const Z = 2.2;
      const wx = (lx - L.view.x) / L.view.k;
      const wy = (ly - L.view.y) / L.view.k;
      const V2 = { k: L.view.k * Z, x: lx - wx * L.view.k * Z, y: ly - wy * L.view.k * Z };
      cx.save();
      cx.beginPath();
      cx.arc(lx, ly, Lr, 0, Math.PI * 2);
      cx.clip();
      cx.fillStyle = 'rgba(7,11,17,.96)';
      cx.fillRect(lx - Lr, ly - Lr, Lr * 2, Lr * 2);
      cx.strokeStyle = `rgba(${CY},.06)`;
      cx.lineWidth = 1;
      for (let g = -Lr; g <= Lr; g += 14) {
        cx.beginPath();
        cx.moveTo(lx + g, ly - Lr);
        cx.lineTo(lx + g, ly + Lr);
        cx.moveTo(lx - Lr, ly + g);
        cx.lineTo(lx + Lr, ly + g);
        cx.stroke();
      }
      scene(t, V2, true);
      if (!L.reduced) {
        const sy = ly - Lr + ((t * 0.45) % 1) * Lr * 2;
        const g = cx.createLinearGradient(0, sy - 30, 0, sy);
        g.addColorStop(0, `rgba(${CY},0)`);
        g.addColorStop(1, `rgba(${CY},.28)`);
        cx.fillStyle = g;
        cx.fillRect(lx - Lr, sy - 30, Lr * 2, 30);
        cx.fillStyle = `rgba(${CY},.8)`;
        cx.fillRect(lx - Lr, sy, Lr * 2, 1.2);
      }
      cx.restore();
      cx.strokeStyle = `rgba(${CY},.55)`;
      cx.lineWidth = 1.5;
      cx.beginPath();
      cx.arc(lx, ly, Lr, 0, Math.PI * 2);
      cx.stroke();
      const B = Lr * 0.62;
      const Lb = 14;
      cx.strokeStyle = `rgb(${CY})`;
      cx.lineWidth = 2;
      for (const [sx, sy] of [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ] as const) {
        cx.beginPath();
        cx.moveTo(lx + sx * B, ly + sy * (B - Lb));
        cx.lineTo(lx + sx * B, ly + sy * B);
        cx.lineTo(lx + sx * (B - Lb), ly + sy * B);
        cx.stroke();
      }
      cx.strokeStyle = `rgba(${CY},.25)`;
      cx.lineWidth = 1;
      for (let k = 0; k < 72; k++) {
        const a = (k / 72) * Math.PI * 2;
        const l = k % 6 ? 3 : 7;
        cx.beginPath();
        cx.moveTo(lx + Math.cos(a) * (Lr + 5), ly + Math.sin(a) * (Lr + 5));
        cx.lineTo(lx + Math.cos(a) * (Lr + 5 + l), ly + Math.sin(a) * (Lr + 5 + l));
        cx.stroke();
      }
      // readout: the campaign nearest the lens
      let best: NetNode | null = null;
      let bd = Infinity;
      for (const n of camps) {
        const s = screenOf(n.id);
        if (!s) continue;
        const d = Math.hypot(s[0] - lx, s[1] - ly);
        if (d < bd) {
          bd = d;
          best = n;
        }
      }
      if (best && bd < Lr * 1.4) {
        const c = riskRGB(best);
        const bx = lx + Lr * 0.72;
        const byy = ly + Lr * 0.72;
        const name = L.props.label(best).name;
        cx.textAlign = 'left';
        cx.textBaseline = 'alphabetic';
        cx.fillStyle = 'rgba(11,16,24,.92)';
        cx.beginPath();
        if (cx.roundRect) cx.roundRect(bx, byy, 168, 46, 10);
        else cx.rect(bx, byy, 168, 46);
        cx.fill();
        cx.strokeStyle = 'rgba(255,255,255,.1)';
        cx.stroke();
        cx.font = `400 10px ${fonts.mono}`;
        cx.fillStyle = 'rgba(147,161,181,.9)';
        cx.fillText(L.props.lensTitle, bx + 10, byy + 16);
        cx.font = `400 22px ${fonts.serif}`;
        cx.fillStyle = `rgb(${c})`;
        cx.fillText(String(best.risk ?? ''), bx + 10, byy + 38);
        cx.font = `500 12px ${fonts.sans}`;
        cx.fillStyle = '#e8eef6';
        cx.fillText(name.length > 16 ? `${name.slice(0, 15)}…` : name, bx + 44, byy + 37);
      }
    };

    // the card follows its node
    const placeCard = () => {
      const card = cardRef.current;
      const id = L.props.selected;
      if (!card || !id) return;
      const s = screenOf(id);
      if (!s) return;
      const { w, h } = L.size;
      const node = L.props.net.nodes.find((n) => n.id === id);
      const r = node ? RADIUS[node.kind] : 8;
      const cw = card.offsetWidth || 280;
      let px = s[0] + r + 14;
      if (px + cw > w - 8) px = s[0] - r - cw - 14;
      card.style.left = `${Math.max(8, px)}px`;
      card.style.top = `${Math.max(12, Math.min(h - card.offsetHeight - 12, s[1] - card.offsetHeight / 2))}px`;
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div ref={stageRef} className="sn-stage">
      <canvas ref={canvasRef} aria-label={props.ariaLabel} role="img" />
      {props.selected && props.card && (
        <div ref={cardRef} className="sn-card" key={props.selected}>
          {props.card}
        </div>
      )}
    </div>
  );
});
