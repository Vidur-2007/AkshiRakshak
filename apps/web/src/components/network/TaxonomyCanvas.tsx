/**
 * The scam taxonomy wall (design "Scam taxonomy · Network V3", 2026-11-21): four levers at the
 * centre, tactics and tricks in rings, sample messages drawn as little cards at the edge, joined by
 * thin threads in the lever's colour. Hover traces a thread back to its lever; click a card to open
 * it; drag to pan, wheel or buttons to zoom.
 *
 * Canvas 2D, no library. Each card is drawn once to an offscreen canvas. Reduced motion: no
 * easing. The page keeps a keyboard and screen-reader list of every message.
 */
import { useReducedMotion } from 'motion/react';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import {
  amountIn,
  CARD_H,
  CARD_W,
  LEVERS,
  trickIdOf,
  type LeverId,
  type TaxMessage,
  type TaxNode,
  type Taxonomy,
} from '@/lib/taxonomy';

export interface CardLabels {
  sms: string;
  whatsapp: string;
  telegram: string;
  call: string;
  email: string;
  upi: string;
  pay: string;
  decline: string;
  qr: string;
  sample: string;
}
export type HoverItem = { node: TaxNode } | { message: TaxMessage };
export interface TaxonomyHandle {
  zoomBy(f: number): void;
  fit(): void;
  /** fly to a node or message by id */
  flyTo(id: string): void;
}

const SC = 3;
export const CARD_PX_W = CARD_W * SC;
export const CARD_PX_H = CARD_H * SC;
const COLOR = Object.fromEntries(LEVERS.map((l) => [l.id, l.color])) as Record<LeverId, string>;

const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
};

function rr(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  if (c.roundRect) c.roundRect(x, y, w, h, r);
  else c.rect(x, y, w, h);
}

/** Word-wrap into at most `maxLines`, breaking very long words (links) by character. */
function wrap(
  c: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxW: number,
  lh: number,
  maxLines: number,
) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (let w of words) {
    while (c.measureText(w).width > maxW && w.length > 4) {
      let cut = w.length - 1;
      while (cut > 1 && c.measureText(w.slice(0, cut)).width > maxW) cut -= 1;
      if (line) lines.push(line);
      lines.push(w.slice(0, cut));
      line = '';
      w = w.slice(cut);
    }
    const test = line ? `${line} ${w}` : w;
    if (c.measureText(test).width > maxW && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  const shown = lines.slice(0, maxLines);
  if (lines.length > maxLines)
    shown[maxLines - 1] = `${shown[maxLines - 1]!.replace(/.{0,2}$/, '')}…`;
  shown.forEach((l, i) => c.fillText(l, x, y + i * lh));
}

interface Fonts {
  serif: string;
  sans: string;
  mono: string;
}
function readFonts(): Fonts {
  const css = getComputedStyle(document.documentElement);
  return {
    serif: css.getPropertyValue('--font-serif').trim() || 'Georgia, serif',
    sans: css.getPropertyValue('--font-sans').trim() || 'system-ui, sans-serif',
    mono: css.getPropertyValue('--font-mono').trim() || 'monospace',
  };
}

/** Draw a sample message as a little phone-screen card, CARD_PX_W × CARD_PX_H. */
export function drawCard(cv: HTMLCanvasElement, m: TaxMessage, L: CardLabels) {
  cv.width = CARD_PX_W;
  cv.height = CARD_PX_H;
  const c = cv.getContext('2d');
  if (!c) return;
  const fonts = readFonts();
  const W = CARD_PX_W;
  const H = CARD_PX_H;
  const F = (w: number, s: number) => `${w} ${s}px ${fonts.sans}`;
  c.textBaseline = 'top';
  const tag = (x: number, y: number, fg: string, bg: string) => {
    c.font = F(600, 13);
    const w = c.measureText(L.sample).width + 16;
    c.fillStyle = bg;
    rr(c, x - w, y, w, 22, 11);
    c.fill();
    c.fillStyle = fg;
    c.fillText(L.sample, x - w + 8, y + 4);
  };
  if (m.card === 'sms') {
    c.fillStyle = '#eef1f5';
    c.fillRect(0, 0, W, H);
    c.fillStyle = '#dfe4ea';
    c.fillRect(0, 0, W, 54);
    c.fillStyle = '#1b2330';
    c.font = F(600, 20);
    c.fillText(L.sms, 18, 17);
    tag(W - 14, 16, '#3b4656', '#cdd4dc');
    c.fillStyle = '#dde3ea';
    rr(c, 14, 72, W - 40, 230, 22);
    c.fill();
    c.fillStyle = '#1b2330';
    c.font = F(400, 19);
    wrap(c, m.text, 30, 88, W - 70, 25, 8);
  } else if (m.card === 'chat') {
    const wa = m.channel === 'whatsapp';
    c.fillStyle = '#0f1a20';
    c.fillRect(0, 0, W, H);
    c.fillStyle = wa ? '#1f5c4d' : '#1f4f86';
    c.fillRect(0, 0, W, 58);
    c.fillStyle = 'rgba(255,255,255,.35)';
    c.beginPath();
    c.arc(32, 29, 16, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#e8eef6';
    c.font = F(600, 18);
    c.fillText(wa ? L.whatsapp : L.telegram, 58, 18);
    tag(W - 12, 18, '#e8eef6', 'rgba(255,255,255,.18)');
    c.fillStyle = '#22343c';
    rr(c, 14, 78, W - 50, 236, 18);
    c.fill();
    c.fillStyle = '#e8eef6';
    c.font = F(400, 18);
    wrap(c, m.text, 28, 94, W - 80, 24, 9);
  } else if (m.card === 'call') {
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#141c28');
    g.addColorStop(1, '#06090e');
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
    c.textAlign = 'center';
    c.fillStyle = '#93a1b5';
    c.font = F(400, 16);
    c.fillText(L.call, W / 2, 22);
    c.fillStyle = '#2a3646';
    c.beginPath();
    c.arc(W / 2, 86, 34, 0, Math.PI * 2);
    c.fill();
    c.textAlign = 'left';
    c.fillStyle = '#c4cfdc';
    c.font = F(400, 16);
    wrap(c, `“${m.text}”`, 20, 136, W - 40, 21, 8);
    c.fillStyle = '#d91f45';
    c.beginPath();
    c.arc(W / 2 - 60, H - 40, 22, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#1fa463';
    c.beginPath();
    c.arc(W / 2 + 60, H - 40, 22, 0, Math.PI * 2);
    c.fill();
  } else if (m.card === 'email') {
    const col = ['#b3261e', '#1f4fa3', '#0e6b52'][m.v % 3]!;
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, W, H);
    c.fillStyle = col;
    c.fillRect(0, 0, W, 46);
    c.fillStyle = '#fff';
    c.font = F(700, 18);
    c.fillText(L.email, 16, 14);
    tag(W - 12, 12, '#fff', 'rgba(255,255,255,.22)');
    c.fillStyle = '#111';
    c.font = F(600, 18);
    wrap(c, m.text, 16, 62, W - 32, 24, 8);
    c.fillStyle = col;
    rr(c, 16, H - 62, 150, 40, 8);
    c.fill();
  } else if (m.card === 'upi') {
    c.fillStyle = '#0d131c';
    c.fillRect(0, 0, W, H);
    c.fillStyle = '#18233a';
    c.fillRect(0, 0, W, 60);
    c.fillStyle = '#c4cfdc';
    c.font = F(600, 17);
    c.fillText(L.upi, 16, 20);
    c.fillStyle = '#fff';
    c.font = `400 60px ${fonts.serif}`;
    c.fillText(amountIn(m.text) ?? '₹', 16, 78);
    c.fillStyle = '#c4cfdc';
    c.font = F(400, 16);
    wrap(c, m.text, 16, 150, W - 32, 21, 6);
    c.fillStyle = '#d91f45';
    rr(c, 16, H - 62, (W - 44) / 2, 44, 10);
    c.fill();
    c.fillStyle = '#fff';
    c.font = F(600, 17);
    c.fillText(L.pay, 40, H - 50);
    c.strokeStyle = '#5b6a80';
    c.lineWidth = 2;
    rr(c, W / 2 + 6, H - 62, (W - 44) / 2, 44, 10);
    c.stroke();
    c.fillStyle = '#c4cfdc';
    c.fillText(L.decline, W / 2 + 24, H - 50);
  } else {
    // a decorative QR pattern: not a real code
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, W, H);
    const N = 21;
    const s = Math.floor((W - 70) / N);
    const ox = (W - s * N) / 2;
    let q = 7 + m.v * 13;
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        q = (q * 16807) % 2147483647;
        const fx = x >= N - 7 ? x - (N - 7) : x;
        const fy = y >= N - 7 ? y - (N - 7) : y;
        const finder = (x < 7 && y < 7) || (x >= N - 7 && y < 7) || (x < 7 && y >= N - 7);
        const on = finder
          ? fx === 0 ||
            fx === 6 ||
            fy === 0 ||
            fy === 6 ||
            (fx >= 2 && fx <= 4 && fy >= 2 && fy <= 4)
          : q % 3 === 0;
        if (!on) continue;
        c.fillStyle = '#111';
        c.fillRect(ox + x * s, 20 + y * s, s, s);
      }
    c.textAlign = 'center';
    c.fillStyle = '#111';
    c.font = F(700, 18);
    c.fillText(L.qr, W / 2, H - 84);
    c.fillStyle = '#b3261e';
    c.font = F(700, 24);
    c.fillText(amountIn(m.text) ?? '', W / 2, H - 56);
    c.textAlign = 'left';
  }
}

export const TaxonomyCanvas = forwardRef<
  TaxonomyHandle,
  {
    tax: Taxonomy;
    on: Record<LeverId, boolean>;
    /** message ids that match the search, or null when not searching */
    matches: Set<string> | null;
    /** a node lit up without hovering (?category=) */
    focus: string | null;
    selected: string | null;
    onHover: (item: HoverItem | null) => void;
    onPick: (m: TaxMessage | null) => void;
    onInteract: () => void;
    names: { lever: (id: LeverId) => string; node: (n: TaxNode) => string };
    labels: CardLabels;
    ariaLabel: string;
    /** room kept free on the right while the detail panel is open */
    panelOpen: boolean;
    /** fly to this node or message once the wall has a size (?category= links) */
    flyToId?: string | null;
  }
>(function TaxonomyCanvas(props, ref) {
  const reduced = useReducedMotion() ?? false;
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const live = useRef({
    props,
    reduced,
    view: { x: 0, y: 0, k: 0.4 },
    goal: { x: 0, y: 0, k: 0.4 },
    size: { w: 0, h: 0, dpr: 1 },
    hover: null as HoverItem | null,
    cards: new Map<string, HTMLCanvasElement>(),
    fitted: false,
    flown: null as string | null,
  });
  live.current.props = props;
  live.current.reduced = reduced;

  const fit = () => {
    const L = live.current;
    const { w, h } = L.size;
    if (!w || !h) return;
    const R = 1700;
    const k =
      w < 700 ? Math.min(w / (R * 1.25), h / (R * 2.4)) : Math.min(w / (R * 2.05), h / (R * 1.75));
    L.goal = { k, x: w / 2, y: h / 2 + 10 };
    if (!L.fitted || L.reduced) {
      L.view = { ...L.goal };
      L.fitted = true;
    }
  };
  const zoomAt = (f: number, sx: number, sy: number) => {
    const g = live.current.goal;
    const wx = (sx - g.x) / g.k;
    const wy = (sy - g.y) / g.k;
    g.k = Math.max(0.15, Math.min(2.5, g.k * f));
    g.x = sx - wx * g.k;
    g.y = sy - wy * g.k;
    if (live.current.reduced) live.current.view = { ...g };
  };
  const flyTo = (x: number, y: number, k: number) => {
    const L = live.current;
    const shift = L.props.panelOpen && L.size.w > 900 ? 190 : 0;
    L.goal = { k, x: L.size.w / 2 - x * k - shift, y: L.size.h / 2 - y * k };
    if (L.reduced) L.view = { ...L.goal };
  };

  const flyToId = (id: string) => {
    const { tax } = live.current.props;
    const n = tax.nodes.find((x) => x.id === id);
    if (n) return flyTo(n.x, n.y, n.kind === 'lever' ? 0.75 : n.kind === 'tactic' ? 0.6 : 0.9);
    const m = tax.messages.find((x) => x.id === id);
    if (m) flyTo(m.x, m.y, 1.1);
  };

  useImperativeHandle(ref, () => ({
    zoomBy: (f) => zoomAt(f, live.current.size.w / 2, live.current.size.h / 2),
    fit,
    flyTo: (id) => flyToId(id),
  }));

  // the cards follow the language of the labels
  useEffect(() => {
    live.current.cards.clear();
  }, [props.tax, props.labels]);

  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!stage || !canvas) return;
    const ro = new ResizeObserver(() => {
      const r = stage.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      live.current.size = { w: r.width, h: r.height, dpr };
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
      fit();
    });
    ro.observe(stage);
    return () => ro.disconnect();
  }, []);

  // pointer: pan, hover, click; wheel zoom (not passive, so the page does not scroll)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const L = live.current;
    const local = (e: { clientX: number; clientY: number }) => {
      const r = canvas.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top] as const;
    };
    const pick = (sx: number, sy: number): HoverItem | null => {
      const { tax, on } = L.props;
      const wx = (sx - L.view.x) / L.view.k;
      const wy = (sy - L.view.y) / L.view.k;
      for (let i = tax.messages.length - 1; i >= 0; i--) {
        const m = tax.messages[i]!;
        if (on[m.lever] && Math.abs(wx - m.x) < CARD_W / 2 && Math.abs(wy - m.y) < CARD_H / 2)
          return { message: m };
      }
      let best: TaxNode | null = null;
      let bd = Infinity;
      for (const n of tax.nodes) {
        if (!on[n.lever]) continue;
        const d = Math.hypot(wx - n.x, wy - n.y);
        const lim = n.kind === 'lever' ? 60 : n.kind === 'tactic' ? 40 : 24;
        if (d < lim && d < bd) {
          bd = d;
          best = n;
        }
      }
      return best ? { node: best } : null;
    };
    let drag: { x: number; y: number; vx: number; vy: number; moved: boolean } | null = null;
    const down = (e: PointerEvent) => {
      drag = { x: e.clientX, y: e.clientY, vx: L.goal.x, vy: L.goal.y, moved: false };
      canvas.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (drag) {
        const dx = e.clientX - drag.x;
        const dy = e.clientY - drag.y;
        if (Math.abs(dx) + Math.abs(dy) > 4 && !drag.moved) {
          drag.moved = true;
          canvas.classList.add('drag');
          L.props.onInteract();
        }
        L.goal.x = drag.vx + dx;
        L.goal.y = drag.vy + dy;
        L.view.x = L.goal.x;
        L.view.y = L.goal.y;
        return;
      }
      const [sx, sy] = local(e);
      const h = pick(sx, sy);
      const same =
        (h && 'message' in h && L.hover && 'message' in L.hover && h.message === L.hover.message) ||
        (h && 'node' in h && L.hover && 'node' in L.hover && h.node === L.hover.node) ||
        (!h && !L.hover);
      if (!same) {
        L.hover = h;
        if (h) L.props.onInteract();
        L.props.onHover(h);
      }
      canvas.style.cursor = h ? 'pointer' : '';
    };
    const up = (e: PointerEvent) => {
      canvas.classList.remove('drag');
      if (drag && !drag.moved) {
        L.props.onInteract();
        const [sx, sy] = local(e);
        const h = pick(sx, sy);
        if (h && 'message' in h) L.props.onPick(h.message);
        else if (h && 'node' in h) flyTo(h.node.x, h.node.y, h.node.kind === 'lever' ? 0.75 : 1.1);
        else L.props.onPick(null);
      }
      drag = null;
    };
    const leave = () => {
      L.hover = null;
      L.props.onHover(null);
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      L.props.onInteract();
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

  // the drawing loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const cx = canvas?.getContext('2d');
    if (!canvas || !cx) return;
    const fonts = readFonts();
    const L = live.current;
    let raf = 0;

    const frame = () => {
      const { tax, on, matches, focus, selected, names, labels } = L.props;
      if (L.props.flyToId && L.props.flyToId !== L.flown && L.size.w) {
        L.flown = L.props.flyToId;
        flyToId(L.props.flyToId);
      }
      const s = L.reduced ? 1 : 0.14;
      L.view.x += (L.goal.x - L.view.x) * s;
      L.view.y += (L.goal.y - L.view.y) * s;
      L.view.k += (L.goal.k - L.view.k) * s;
      const { w: W, h: H, dpr } = L.size;
      cx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cx.clearRect(0, 0, W, H);
      const k = L.view.k;
      const toS = (x: number, y: number) => [x * k + L.view.x, y * k + L.view.y] as const;

      // what to light up: the hovered item's thread, or the focused node's
      const hov = L.hover ?? (focus ? { node: tax.nodes.find((n) => n.id === focus)! } : null);
      const related = (item: {
        lever: LeverId;
        category?: ScamLike;
        channel?: string;
        kind?: string;
        id: string;
      }) => {
        if (!hov || ('node' in hov && !hov.node)) return true;
        if ('message' in hov) {
          const m = hov.message;
          if (item.lever !== m.lever) return false;
          return (
            item.kind === 'lever' ||
            item.id === m.id ||
            item.id === `tactic:${m.category}` ||
            item.id === trickIdOf(m)
          );
        }
        const n = hov.node;
        if (item.lever !== n.lever) return false;
        if (n.kind === 'lever') return true;
        if (n.kind === 'tactic') return item.kind === 'lever' || item.category === n.category;
        return (
          item.kind === 'lever' ||
          item.id === `tactic:${n.category}` ||
          item.id === n.id ||
          (item.category === n.category && item.channel === n.channel && !item.kind)
        );
      };
      const lit = !!hov && !('node' in hov && !hov.node);

      // threads from each card back to its trick
      for (const m of tax.messages) {
        if (!on[m.lever]) continue;
        const rel = related(m) || selected === m.id;
        const a = lit ? (rel ? 0.75 : 0.05) : matches ? (matches.has(m.id) ? 0.7 : 0.05) : 0.16;
        const t = tax.nodes.find((n) => n.id === trickIdOf(m));
        if (!t) continue;
        const [x1, y1] = toS(t.x, t.y);
        const [x2, y2] = toS(m.x, m.y);
        const mx = (x1 + x2) / 2 + (y2 - y1) * 0.12;
        const my = (y1 + y2) / 2 - (x2 - x1) * 0.12;
        cx.strokeStyle = rgba(COLOR[m.lever], a);
        cx.lineWidth = rel && lit ? 1.4 : 1;
        cx.beginPath();
        cx.moveTo(x1, y1);
        cx.quadraticCurveTo(mx, my, x2, y2);
        cx.stroke();
      }
      // lever → tactic → trick
      const byId = new Map(tax.nodes.map((n) => [n.id, n]));
      for (const [ai, bi] of tax.links) {
        const A = byId.get(ai)!;
        const B = byId.get(bi)!;
        if (!on[A.lever]) continue;
        const rel = related(A) && related(B);
        const [x1, y1] = toS(A.x, A.y);
        const [x2, y2] = toS(B.x, B.y);
        cx.strokeStyle = rgba(COLOR[A.lever], lit ? (rel ? 0.9 : 0.08) : 0.45);
        cx.lineWidth = 1.2;
        cx.beginPath();
        cx.moveTo(x1, y1);
        cx.lineTo(x2, y2);
        cx.stroke();
      }
      // message cards
      for (const m of tax.messages) {
        if (!on[m.lever]) continue;
        const [x, y] = toS(m.x, m.y);
        const w = CARD_W * k;
        const h = CARD_H * k;
        if (x + w < 0 || x - w > W || y + h < 0 || y - h > H) continue;
        let img = L.cards.get(m.id);
        if (!img) {
          img = document.createElement('canvas');
          drawCard(img, m, labels);
          L.cards.set(m.id, img);
        }
        const rel = related(m) || selected === m.id;
        const dim = (lit && !rel) || (matches !== null && !matches.has(m.id));
        cx.globalAlpha = dim ? 0.18 : 1;
        cx.save();
        cx.translate(x, y);
        cx.rotate(m.rot);
        cx.fillStyle = 'rgba(0,0,0,.45)';
        cx.fillRect(-w / 2 + 2, -h / 2 + 3, w, h);
        cx.drawImage(img, -w / 2, -h / 2, w, h);
        const hovered = L.hover && 'message' in L.hover && L.hover.message === m;
        if (hovered || selected === m.id) {
          cx.strokeStyle = COLOR[m.lever];
          cx.lineWidth = 2;
          cx.strokeRect(-w / 2 - 3, -h / 2 - 3, w + 6, h + 6);
        }
        cx.restore();
        cx.globalAlpha = 1;
      }
      // tricks and tactics
      for (const n of tax.nodes) {
        if (!on[n.lever] || n.kind === 'lever') continue;
        const [x, y] = toS(n.x, n.y);
        const rel = related(n);
        cx.globalAlpha = lit && !rel ? 0.2 : 1;
        const col = COLOR[n.lever];
        if (n.kind === 'trick') {
          cx.fillStyle = col;
          cx.beginPath();
          cx.arc(x, y, 3.2, 0, Math.PI * 2);
          cx.fill();
          if (k > 0.62 || (lit && rel)) {
            cx.font = `400 11px ${fonts.sans}`;
            cx.fillStyle = '#c4cfdc';
            cx.textAlign = 'center';
            cx.textBaseline = 'top';
            cx.fillText(names.node(n), x, y + 8);
          }
        } else if (k < 0.42 && !(lit && rel) && focus !== n.id) {
          cx.fillStyle = col;
          cx.fillRect(x - 4, y - 4, 8, 8);
        } else {
          const label = names.node(n);
          cx.font = `500 12.5px ${fonts.sans}`;
          const w = cx.measureText(label).width + 22;
          const h = 26;
          cx.fillStyle = '#0b1018';
          rr(cx, x - w / 2, y - h / 2, w, h, 6);
          cx.fill();
          cx.strokeStyle = rgba(col, focus === n.id ? 1 : 0.55);
          cx.lineWidth = focus === n.id ? 2 : 1;
          cx.stroke();
          cx.fillStyle = col;
          cx.fillRect(x - w / 2 + 8, y - 3, 6, 6);
          cx.fillStyle = '#e8eef6';
          cx.textAlign = 'left';
          cx.textBaseline = 'middle';
          cx.fillText(label, x - w / 2 + 18, y + 0.5);
        }
        cx.globalAlpha = 1;
      }
      // levers
      for (const lever of LEVERS) {
        if (!on[lever.id]) continue;
        const n = byId.get(`lever:${lever.id}`)!;
        const [x, y] = toS(n.x, n.y);
        const r = Math.max(24, Math.min(64, 70 * k));
        cx.globalAlpha = lit && !related(n) ? 0.25 : 1;
        cx.fillStyle = '#0b1018';
        cx.beginPath();
        cx.arc(x, y, r, 0, Math.PI * 2);
        cx.fill();
        cx.strokeStyle = rgba(lever.color, 0.9);
        cx.lineWidth = 1.5;
        cx.stroke();
        cx.strokeStyle = rgba(lever.color, 0.25);
        cx.setLineDash([2, 4]);
        cx.beginPath();
        cx.arc(x, y, r + 6, 0, Math.PI * 2);
        cx.stroke();
        cx.setLineDash([]);
        cx.fillStyle = lever.color;
        cx.fillRect(x - 4, y - r * 0.42, 8, 8);
        cx.fillStyle = '#e8eef6';
        cx.font = `400 ${Math.round(r * 0.46)}px ${fonts.serif}`;
        cx.textAlign = 'center';
        cx.textBaseline = 'middle';
        cx.fillText(names.lever(lever.id), x, y + r * 0.12);
        cx.globalAlpha = 1;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div ref={stageRef} className="tx-stage">
      <canvas ref={canvasRef} role="img" aria-label={props.ariaLabel} />
    </div>
  );
});

type ScamLike = TaxNode['category'];
