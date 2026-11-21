/**
 * The interactive entity graph (§5.12): react-force-graph-2d, loaded lazily with the Network page.
 *
 * Drawn as "cosmic connections" (design 2026-11-20): a dark space with faint dust, campaigns as
 * glowing purple hubs, phone numbers / UPI IDs / websites as cyan sparks (shape still tells the
 * type), links as filaments of light with sparks travelling along them. Light adds up
 * ('lighter'), so busy clusters glow. Size by reports, a ring on the user's own details,
 * sample-data nodes dimmer; hover highlights neighbours. The canvas is dark in both themes.
 */
import { useReducedMotion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import ForceGraph2D, { type ForceGraphMethods } from 'react-force-graph-2d';
import type { EntityGraph, GraphNode } from '@/lib/engine';
import { neighbours } from '@/lib/graph';
import { rng } from '@/lib/cosmic';

/** Node colours by type (the cosmic palette; the canvas is always dark). */
export const TYPE_COLOR: Record<GraphNode['type'], string> = {
  phone: '#25b8ff',
  upi: '#3de0ff',
  domain: '#8fb3ff',
  campaign: '#b04dff',
};

/** "#rrggbb" + alpha → rgba() */
function rgba(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** Repulsion only between nearby nodes, so separate campaigns pack close instead of drifting. */
interface ManyBody {
  strength(s: number): ManyBody;
  distanceMax(d: number): ManyBody;
}
interface LinkForce {
  distance(d: number): LinkForce;
}

type FgNode = GraphNode & { x?: number; y?: number };
type FgLink = { source: string | FgNode; target: string | FgNode; kind: string };

const idOf = (v: string | FgNode) => (typeof v === 'string' ? v : v.id);
const radiusOf = (n: GraphNode) => 4 + Math.min(8, n.reports) * 0.7;

function drawShape(
  ctx: CanvasRenderingContext2D,
  type: GraphNode['type'],
  x: number,
  y: number,
  r: number,
) {
  ctx.beginPath();
  if (type === 'phone') ctx.arc(x, y, r, 0, Math.PI * 2);
  else if (type === 'upi') {
    ctx.moveTo(x, y - r);
    ctx.lineTo(x + r, y);
    ctx.lineTo(x, y + r);
    ctx.lineTo(x - r, y);
    ctx.closePath();
  } else if (type === 'domain') ctx.rect(x - r * 0.85, y - r * 0.85, r * 1.7, r * 1.7);
  else {
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 6;
      const px = x + Math.cos(a) * r * 1.15;
      const py = y + Math.sin(a) * r * 1.15;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }
}

/**
 * The backdrop: a faint cosmic web (soft purple hubs joined by filaments of dust) in screen space,
 * drawn once per size to an offscreen canvas. Decoration only: it is far dimmer than the real
 * links, never touches the data nodes, and is the same every time (seeded).
 */
function drawWeb(w: number, h: number, pr: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.round(w * pr);
  c.height = Math.round(h * pr);
  const ctx = c.getContext('2d');
  if (!ctx) return c;
  ctx.scale(pr, pr);
  ctx.globalCompositeOperation = 'lighter';
  const r = rng(29);
  const hubs = Array.from({ length: 22 }, () => ({ x: r() * w, y: r() * h }));
  for (const a of hubs) {
    const near = hubs
      .filter((b) => b !== a)
      .sort((p, q) => (p.x - a.x) ** 2 + (p.y - a.y) ** 2 - ((q.x - a.x) ** 2 + (q.y - a.y) ** 2))
      .slice(0, 2 + Math.floor(r() * 2));
    for (const b of near) {
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const bend = (r() - 0.5) * 0.35 * len;
      const n = Math.round(len / 2.2);
      for (let i = 0; i < n; i++) {
        const t = r();
        const off = Math.sin(t * Math.PI) * bend;
        const x = a.x + (b.x - a.x) * t - ((b.y - a.y) / len) * off + (r() - 0.5) * 7;
        const y = a.y + (b.y - a.y) * t + ((b.x - a.x) / len) * off + (r() - 0.5) * 7;
        ctx.fillStyle = `rgba(61,190,255,${0.08 + r() * 0.2})`;
        const s = 0.6 + r() * 1.1;
        ctx.fillRect(x, y, s, s);
      }
    }
  }
  for (const a of hubs) {
    const rad = 10 + r() * 22;
    const g = ctx.createRadialGradient(a.x, a.y, 0, a.x, a.y, rad);
    g.addColorStop(0, 'rgba(176,77,255,0.3)');
    g.addColorStop(1, 'rgba(176,77,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(a.x - rad, a.y - rad, rad * 2, rad * 2);
  }
  return c;
}

/** Stars that twinkle over the web (fractions of the box, seeded). */
const STARS = (() => {
  const r = rng(31);
  return Array.from({ length: 160 }, () => ({
    x: r(),
    y: r(),
    s: 0.6 + r() * 1.3,
    p: r() * 6.28,
    c: r(),
  }));
})();

export default function ForceGraphView({
  graph,
  selectedId,
  onSelect,
}: {
  graph: EntityGraph;
  selectedId: string | null;
  onSelect: (node: GraphNode) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 600, h: 420 });
  const [hover, setHover] = useState<string | null>(null);
  const reduced = useReducedMotion() ?? false;
  const fgRef = useRef<ForceGraphMethods | undefined>(undefined);
  const fitted = useRef(false);
  const webRef = useRef<{ key: string; c: HTMLCanvasElement } | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      if (e)
        setSize({
          w: Math.round(e.contentRect.width),
          h: Math.max(340, Math.round(Math.min(600, e.contentRect.width * 0.7))),
        });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // react-force-graph mutates nodes (x, y); give it copies
  const data = useMemo(
    () => ({
      nodes: graph.nodes.map((n) => ({ ...n })) as FgNode[],
      links: graph.edges.map((e) => ({ ...e })) as FgLink[],
    }),
    [graph],
  );
  // tighter layout: short links, short-range repulsion (set once the graph exists)
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    (fg.d3Force('charge') as unknown as ManyBody | undefined)?.strength(-22).distanceMax(70);
    (fg.d3Force('link') as unknown as LinkForce | undefined)?.distance(40);
    fitted.current = false;
    fg.d3ReheatSimulation();
  }, [data]);

  const focus = hover ?? selectedId;
  const near = useMemo(() => (focus ? neighbours(graph, focus) : null), [graph, focus]);
  const onFocus = (l: FgLink) => !!focus && (idOf(l.source) === focus || idOf(l.target) === focus);

  return (
    <div
      ref={wrapRef}
      className="w-full overflow-hidden rounded-card border border-white/10 bg-[radial-gradient(ellipse_at_50%_45%,#1a0b2e_0%,#0a0814_45%,#05070b_100%)]"
      aria-hidden
    >
      <ForceGraph2D
        ref={fgRef as never}
        graphData={data}
        width={size.w}
        height={size.h}
        backgroundColor="rgba(0,0,0,0)"
        nodeId="id"
        nodeLabel={(n: FgNode) => n.label}
        cooldownTicks={reduced ? 0 : 120}
        warmupTicks={reduced ? 120 : 20}
        enableNodeDrag={!reduced}
        // keep redrawing so the dust twinkles and the link sparks travel
        autoPauseRedraw={reduced}
        // separate scam campaigns drift apart; zoom so they fill the box once the layout settles
        onEngineStop={() => {
          if (fitted.current) return;
          fitted.current = true;
          fgRef.current?.zoomToFit(reduced ? 0 : 500, 28);
        }}
        onNodeHover={(n: FgNode | null) => setHover(n ? n.id : null)}
        onNodeClick={(n: FgNode) => onSelect(n)}
        onRenderFramePre={(ctx: CanvasRenderingContext2D) => {
          const cw = ctx.canvas.width;
          const ch = ctx.canvas.height;
          const pr = cw / Math.max(1, size.w);
          const key = `${cw}x${ch}`;
          if (webRef.current?.key !== key) webRef.current = { key, c: drawWeb(size.w, size.h, pr) };
          const time = reduced ? 0 : performance.now() / 1000;
          ctx.save();
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = reduced ? 1 : 0.85 + 0.15 * Math.sin(time * 0.6);
          ctx.drawImage(webRef.current.c, 0, 0, cw, ch);
          ctx.globalAlpha = 1;
          for (const d of STARS) {
            const tw = 0.3 + 0.3 * Math.sin(time * 1.3 + d.p);
            ctx.fillStyle = d.c > 0.8 ? `rgba(176,77,255,${tw})` : `rgba(140,220,255,${tw})`;
            const s = d.s * pr;
            ctx.fillRect(d.x * cw, d.y * ch, s, s);
          }
          ctx.restore();
        }}
        // filaments of light between linked details
        linkCanvasObjectMode={() => 'replace'}
        linkCanvasObject={(l: FgLink, ctx: CanvasRenderingContext2D, scale: number) => {
          const s = l.source as FgNode;
          const t = l.target as FgNode;
          if (s.x === undefined || t.x === undefined) return;
          const on = onFocus(l);
          const faint = !!focus && !on;
          const g = ctx.createLinearGradient(s.x, s.y ?? 0, t.x, t.y ?? 0);
          const a = on ? 0.85 : faint ? 0.05 : 0.32;
          g.addColorStop(0, rgba(TYPE_COLOR[s.type], a));
          g.addColorStop(1, rgba(TYPE_COLOR[t.type], a));
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = g;
          // a wide, faint pass and a thin bright one read as a glowing filament
          ctx.lineWidth = (on ? 5 : 3) / scale;
          ctx.globalAlpha = 0.25;
          ctx.beginPath();
          ctx.moveTo(s.x, s.y ?? 0);
          ctx.lineTo(t.x, t.y ?? 0);
          ctx.stroke();
          ctx.lineWidth = (on ? 1.6 : 0.8) / scale;
          ctx.globalAlpha = 1;
          ctx.stroke();
          ctx.restore();
        }}
        linkDirectionalParticles={reduced ? 0 : 2}
        linkDirectionalParticleSpeed={0.005}
        linkDirectionalParticleWidth={(l: FgLink) => (onFocus(l) ? 3 : 1.6)}
        linkDirectionalParticleColor={() => '#bff4ff'}
        nodeCanvasObjectMode={() => 'replace'}
        nodeCanvasObject={(n: FgNode, ctx: CanvasRenderingContext2D, scale: number) => {
          const x = n.x ?? 0;
          const y = n.y ?? 0;
          const r = radiusOf(n);
          const dim = !!focus && n.id !== focus && !near?.has(n.id);
          const color = TYPE_COLOR[n.type];
          const strength = dim ? 0.15 : n.sampleData ? 0.7 : 1;
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          // glow halo: campaigns glow wider, like the hubs of a cosmic web
          const halo = r * (n.type === 'campaign' ? 5 : 3.2);
          const g = ctx.createRadialGradient(x, y, 0, x, y, halo);
          g.addColorStop(0, rgba(color, 0.55 * strength));
          g.addColorStop(0.35, rgba(color, 0.18 * strength));
          g.addColorStop(1, rgba(color, 0));
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(x, y, halo, 0, Math.PI * 2);
          ctx.fill();
          // bright core in the node's shape
          ctx.globalAlpha = strength;
          drawShape(ctx, n.type, x, y, r * 0.62);
          ctx.fillStyle = color;
          ctx.fill();
          drawShape(ctx, n.type, x, y, r * 0.3);
          ctx.fillStyle = 'rgba(255,255,255,0.85)';
          ctx.fill();
          ctx.restore();
          if (n.mine) {
            ctx.globalAlpha = dim ? 0.2 : 1;
            ctx.lineWidth = 2.2 / scale;
            ctx.strokeStyle = '#3de0ff';
            drawShape(ctx, n.type, x, y, r + 3);
            ctx.stroke();
          }
          if (n.id === selectedId) {
            ctx.globalAlpha = 1;
            ctx.lineWidth = 2 / scale;
            ctx.strokeStyle = '#ffffff';
            drawShape(ctx, n.type, x, y, r + 6);
            ctx.stroke();
          }
          if (scale > 1.6 && !dim) {
            ctx.globalAlpha = 0.9;
            ctx.font = `${11 / scale}px Space Mono, monospace`;
            ctx.fillStyle = '#e8eef6';
            ctx.textAlign = 'center';
            ctx.fillText(n.label, x, y + r + 12 / scale);
          }
          ctx.globalAlpha = 1;
        }}
        nodePointerAreaPaint={(n: FgNode, color: string, ctx: CanvasRenderingContext2D) => {
          ctx.fillStyle = color;
          drawShape(ctx, n.type, n.x ?? 0, n.y ?? 0, radiusOf(n) + 3);
          ctx.fill();
        }}
      />
    </div>
  );
}
