/**
 * Network page helpers (§5.12): filtering, neighbours and the user's scans that
 * mention an entity.
 */
import type { ScanRecord } from './db';
import type { EntityGraph, GraphNode } from './engine';

export type NodeType = GraphNode['type'];

export interface GraphFilter {
  types: Set<NodeType>;
  onlyMine: boolean;
}

export const ALL_TYPES: NodeType[] = ['phone', 'upi', 'domain', 'campaign'];

const endId = (e: unknown): string =>
  typeof e === 'object' && e !== null ? String((e as { id: unknown }).id) : String(e);

/**
 * Nodes of the chosen types. "Only mine" keeps the user's own details, plus the
 * campaigns they link to (a campaign is never "mine" itself).
 */
export function filterGraph(g: EntityGraph, f: GraphFilter): EntityGraph {
  const typed = g.nodes.filter((n) => f.types.has(n.type));
  let keep = new Set(typed.map((n) => n.id));
  if (f.onlyMine) {
    const mine = new Set(typed.filter((n) => n.mine).map((n) => n.id));
    const linkedCampaigns = new Set<string>();
    for (const e of g.edges) {
      const s = endId(e.source);
      const t = endId(e.target);
      if (mine.has(s)) linkedCampaigns.add(t);
      if (mine.has(t)) linkedCampaigns.add(s);
    }
    keep = new Set(
      typed
        .filter((n) => mine.has(n.id) || (n.type === 'campaign' && linkedCampaigns.has(n.id)))
        .map((n) => n.id),
    );
  }
  return {
    nodes: g.nodes.filter((n) => keep.has(n.id)),
    edges: g.edges.filter((e) => keep.has(endId(e.source)) && keep.has(endId(e.target))),
    stats: g.stats,
  };
}

export function neighbours(g: EntityGraph, id: string): Set<string> {
  const out = new Set<string>();
  for (const e of g.edges) {
    const s = endId(e.source);
    const t = endId(e.target);
    if (s === id) out.add(t);
    if (t === id) out.add(s);
  }
  return out;
}

/** The value a node stands for, as it appears in scan entities. */
export function nodeValue(n: GraphNode): string {
  return n.id.includes(':') ? n.id.slice(n.id.indexOf(':') + 1) : n.label;
}

const digits = (s: string) => s.replace(/\D/g, '').slice(-10);

export function scansMentioning(scans: ScanRecord[], n: GraphNode): ScanRecord[] {
  const v = nodeValue(n).toLowerCase();
  return scans.filter((s) => {
    const e = s.result.entities;
    if (n.type === 'upi')
      return (
        e.upiIds.some((u) => u.raw.toLowerCase() === v) || s.result.qr?.pa?.toLowerCase() === v
      );
    if (n.type === 'phone') return e.phones.some((p) => digits(p.e164 ?? p.raw) === digits(v));
    if (n.type === 'domain')
      return e.urls.some(
        (u) => u.registrableDomain.toLowerCase() === v || u.host.toLowerCase() === v,
      );
    return false;
  });
}

/** "3 clusters · largest has 14 linked details" inputs. */
export function graphStats(g: EntityGraph): { clusters: number; largest: number } {
  return { clusters: g.stats.clusters, largest: g.stats.largestCluster };
}
