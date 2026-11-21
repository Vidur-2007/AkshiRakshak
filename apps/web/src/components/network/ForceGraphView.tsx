/**
 * The interactive entity graph (§5.12): react-force-graph-2d, loaded lazily with
 * the Network page. Node shape and colour by type, size by reports, a cyan ring on
 * the user's own details, translucent sample-data nodes; hover highlights neighbours.
 */
import { useReducedMotion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import ForceGraph2D, { type ForceGraphMethods } from 'react-force-graph-2d';
import type { EntityGraph, GraphNode } from '@/lib/engine';
import { neighbours } from '@/lib/graph';
import { useAppStore } from '@/lib/store';
import { resolveTheme } from '@/lib/theme';

/** Node colours by type, per theme (canvas cannot read CSS variables). */
export const TYPE_COLOR: Record<'night' | 'day', Record<GraphNode['type'], string>> = {
  night: { phone: '#3de0ff', upi: '#9ff0ff', domain: '#93a1b5', campaign: '#7c5cff' },
  day: { phone: '#0891b2', upi: '#0e7490', domain: '#64748b', campaign: '#6d28d9' },
};

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
  // canvas colours cannot read CSS variables: pick label and ring colours for the theme
  const day = resolveTheme(useAppStore((s) => s.theme)) === 'day';
  const ink = day ? '#10161d' : '#e8eef6';

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      if (e)
        setSize({
          w: Math.round(e.contentRect.width),
          h: Math.max(320, Math.round(Math.min(560, e.contentRect.width * 0.7))),
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
    (fg.d3Force('charge') as unknown as ManyBody | undefined)?.strength(-26).distanceMax(90);
    (fg.d3Force('link') as unknown as LinkForce | undefined)?.distance(16);
    fitted.current = false;
    fg.d3ReheatSimulation();
  }, [data]);

  const focus = hover ?? selectedId;
  const near = useMemo(() => (focus ? neighbours(graph, focus) : null), [graph, focus]);

  return (
    <div
      ref={wrapRef}
      className="w-full overflow-hidden rounded-card border border-glass-border bg-surface"
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
        // separate scam campaigns drift apart; zoom so they fill the box once the layout settles
        onEngineStop={() => {
          if (fitted.current) return;
          fitted.current = true;
          fgRef.current?.zoomToFit(reduced ? 0 : 500, 28);
        }}
        onNodeHover={(n: FgNode | null) => setHover(n ? n.id : null)}
        onNodeClick={(n: FgNode) => onSelect(n)}
        linkColor={(l: FgLink) => {
          const on = focus && (idOf(l.source) === focus || idOf(l.target) === focus);
          return on
            ? 'rgba(61,224,255,0.7)'
            : focus
              ? 'rgba(147,161,181,0.08)'
              : 'rgba(147,161,181,0.28)';
        }}
        linkWidth={(l: FgLink) =>
          focus && (idOf(l.source) === focus || idOf(l.target) === focus) ? 2 : 1
        }
        nodeCanvasObjectMode={() => 'replace'}
        nodeCanvasObject={(n: FgNode, ctx: CanvasRenderingContext2D, scale: number) => {
          const x = n.x ?? 0;
          const y = n.y ?? 0;
          const r = 4 + Math.min(8, n.reports) * 0.7;
          const dim = focus && n.id !== focus && !near?.has(n.id);
          ctx.globalAlpha = dim ? 0.15 : n.sampleData ? 0.55 : 1;
          drawShape(ctx, n.type, x, y, r);
          ctx.fillStyle = TYPE_COLOR[day ? 'day' : 'night'][n.type];
          ctx.fill();
          if (n.mine) {
            ctx.globalAlpha = dim ? 0.2 : 1;
            ctx.lineWidth = 2.5 / scale;
            ctx.strokeStyle = day ? '#0891b2' : '#3de0ff';
            drawShape(ctx, n.type, x, y, r + 3.5);
            ctx.stroke();
          }
          if (n.id === selectedId) {
            ctx.lineWidth = 2 / scale;
            ctx.strokeStyle = ink;
            drawShape(ctx, n.type, x, y, r + 6);
            ctx.stroke();
          }
          if (scale > 1.6 && !dim) {
            ctx.globalAlpha = 0.9;
            ctx.font = `${11 / scale}px Space Mono, monospace`;
            ctx.fillStyle = ink;
            ctx.textAlign = 'center';
            ctx.fillText(n.label, x, y + r + 12 / scale);
          }
          ctx.globalAlpha = 1;
        }}
        nodePointerAreaPaint={(n: FgNode, color: string, ctx: CanvasRenderingContext2D) => {
          ctx.fillStyle = color;
          drawShape(ctx, n.type, n.x ?? 0, n.y ?? 0, 4 + Math.min(8, n.reports) * 0.7 + 3);
          ctx.fill();
        }}
      />
    </div>
  );
}
