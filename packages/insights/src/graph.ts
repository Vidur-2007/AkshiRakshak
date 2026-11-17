import type { AnalysisResult, EntityGraph, GraphEdge, GraphNode } from '@akshi/contracts';
import { INDICATORS } from '@akshi/content';

type EntityType = 'phone' | 'upi' | 'domain';

/** One spelling per entity, so "+91 98765 01234" and "9876501234" become the same node. */
export function normaliseEntity(type: EntityType, value: string): string {
  const v = value.trim().toLowerCase();
  if (type === 'phone') {
    const digits = v.replace(/\D/g, '');
    return digits.length >= 10 ? '+91' + digits.slice(-10) : digits;
  }
  if (type === 'domain') return v.replace(/^[a-z]+:\/\//, '').replace(/^www\./, '').replace(/[/?#].*$/, '').replace(/\.$/, '');
  return v;
}

/** Risk shown for a bundled sample indicator that the user has not scanned: more reports, higher risk. */
const bundledRisk = (reports: number) => Math.min(100, 70 + 3 * reports);

/**
 * Entity graph for the network view (SPEC_C_DATA.md §6.6): UPI IDs, phone numbers and domains from the user's
 * scans, joined when they appear in the same scan; with `includeBundled`, the sample indicators and one node per
 * campaign are added.
 */
export function buildEntityGraph(history: AnalysisResult[], opts?: { includeBundled?: boolean }): EntityGraph {
  const nodes = new Map<string, GraphNode>();
  const edges = new Map<string, GraphEdge>();

  const upsert = (type: GraphNode['type'], value: string, patch: Partial<GraphNode>): string | null => {
    const label = type === 'campaign' ? value : normaliseEntity(type, value);
    if (!label) return null;
    const id = `${type}:${label}`;
    const prev = nodes.get(id);
    nodes.set(id, {
      id,
      type,
      label,
      risk: Math.max(prev?.risk ?? 0, Math.round(patch.risk ?? 0)),
      mine: (prev?.mine ?? false) || (patch.mine ?? false),
      reports: Math.max(prev?.reports ?? 0, patch.reports ?? 0),
      sampleData: (prev?.sampleData ?? false) || (patch.sampleData ?? false),
    });
    return id;
  };
  const link = (a: string, b: string, kind: GraphEdge['kind']) => {
    if (a === b) return;
    const [source, target] = kind === 'part_of' || a < b ? [a, b] : [b, a];
    edges.set(`${kind}|${source}|${target}`, { source, target, kind });
  };

  for (const scan of history) {
    const e = scan.entities;
    if (!e) continue;
    const ids: string[] = [];
    const add = (id: string | null) => {
      if (id && !ids.includes(id)) ids.push(id);
    };
    for (const u of e.upiIds ?? []) {
      add(upsert('upi', u.raw, { risk: Math.max(u.risk, 0), mine: true, reports: u.indicator?.reports, sampleData: u.indicator?.sampleData }));
    }
    for (const p of e.phones ?? []) {
      add(upsert('phone', p.e164 ?? p.raw, { risk: scan.riskScore, mine: true, reports: p.indicator?.reports, sampleData: p.indicator?.sampleData }));
    }
    for (const u of e.urls ?? []) {
      if (u.isOfficial) continue; // genuine sites are not part of a scam network
      add(upsert('domain', u.registrableDomain || u.host, { risk: u.risk, mine: true }));
    }
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) link(ids[i]!, ids[j]!, 'appears_with');
  }

  if (opts?.includeBundled) {
    for (const ind of INDICATORS) {
      const id = upsert(ind.type, ind.value, { risk: bundledRisk(ind.reports), reports: ind.reports, sampleData: true });
      if (!id || !ind.campaign) continue;
      const campaign = upsert('campaign', ind.campaign, { risk: bundledRisk(ind.reports), reports: 0, sampleData: true })!;
      link(id, campaign, 'part_of');
    }
    // a campaign's report count is the sum over its members
    for (const node of nodes.values()) {
      if (node.type !== 'campaign') continue;
      node.reports = INDICATORS.filter((i) => i.campaign === node.label).reduce((a, i) => a + i.reports, 0);
    }
  }

  // connected components
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    let root = x;
    while (parent.get(root) !== root) root = parent.get(root)!;
    parent.set(x, root);
    return root;
  };
  for (const id of nodes.keys()) parent.set(id, id);
  for (const { source, target } of edges.values()) parent.set(find(source), find(target));
  const sizes = new Map<string, number>();
  for (const id of nodes.keys()) sizes.set(find(id), (sizes.get(find(id)) ?? 0) + 1);

  return {
    nodes: [...nodes.values()],
    edges: [...edges.values()],
    stats: { clusters: sizes.size, largestCluster: Math.max(0, ...sizes.values()) },
  };
}
