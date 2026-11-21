/**
 * The Scam network model (Network page, design "Scam network V2", 2026-11-21): your checks at the
 * centre, the scam campaigns around them, the channels those campaigns use, and the phone numbers,
 * UPI IDs and websites behind them.
 *
 * Every number has a source:
 * - campaigns, their details and report counts: the bundled sample indicators (sample data);
 * - channels: how the dataset's scam messages of the campaign's kinds arrived (sample data);
 * - which campaigns your checks found, your own details, the activity by day: your scan history;
 * - blocked: your blocklist.
 * Nothing is estimated or invented (SPEC.md §1.3); the page labels the sample parts.
 */
import type { ScanRecord } from './db';
import type { CampaignSamplesData } from './campaignMatch';
import { campaignOfResult } from './campaignMatch';
import { INDICATORS, normaliseEntity, type ScamCategory } from './engine';

export type DetailKind = 'phone' | 'upi' | 'domain';
export type NodeKind = 'core' | 'camp' | 'chan' | 'det' | 'mine';

export interface NetNode {
  id: string;
  kind: NodeKind;
  /** camp: campaign id; chan: channel key; det/mine: the value */
  key: string;
  /** camp */
  category?: ScamCategory;
  risk?: number;
  /** camp: sum of its details' sample reports; det: the detail's sample reports */
  reports?: number;
  /** camp: your risky checks that belong to it (up to the month shown) */
  found?: number;
  /** chan: scam messages in the dataset that came this way */
  messages?: number;
  /** det/mine */
  detail?: DetailKind;
  blocked?: boolean;
  /** det: also in your checks */
  mine?: boolean;
  /** det: its campaign node id */
  parent?: string;
}

export type EdgeKind = 'found' | 'core' | 'channel' | 'detail' | 'shared' | 'mine';
export interface NetEdge {
  a: string;
  b: string;
  kind: EdgeKind;
}

export interface NetStats {
  checks: number;
  scams: number;
  campaignsFound: number;
  blocked: number;
  /** share of campaign details on your blocklist, 0–100 */
  blockedPct: number;
  /** your own details that are part of a campaign */
  mineInCampaigns: number;
  /** checks in the month shown */
  thisMonth: number;
}

export interface ScamNetwork {
  nodes: NetNode[];
  edges: NetEdge[];
  stats: NetStats;
}

export const CORE_ID = 'core';
/** A channel is drawn for a campaign when at least this share of its kinds' messages used it. */
export const CHANNEL_MIN_SHARE = 0.1;
/** Your own details outside any campaign: the most recent ones only, to keep the picture readable. */
export const MINE_MAX = 24;

/** Same formula as the old graph (insights/graph.ts): more sample reports, higher risk. */
const sampleRisk = (reports: number) => Math.min(100, 70 + 3 * reports);
const keyOf = (type: DetailKind, value: string) => `${type}:${normaliseEntity(type, value)}`;

export interface BlockedEntry {
  value: string;
  type: DetailKind;
  addedAt: string;
}

/** Month keys "YYYY-MM": the six months ending with `now`'s month, oldest first. */
export function recentMonths(now: Date, count = 6): string[] {
  const out: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

/** The first moment after a month ("2026-11" → 1 Dec 2026, local time). */
export function monthEnd(month: string): Date {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return new Date(y, m, 1);
}

/** Checks per day across the months (oldest first), for the scrubber's activity wave. */
export function dailyActivity(checks: readonly ScanRecord[], months: readonly string[]): number[] {
  const [y, m] = months[0]!.split('-').map(Number) as [number, number];
  const start = new Date(y, m - 1, 1); // "YYYY-MM" months are 1-based
  const end = monthEnd(months[months.length - 1]!);
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  const out = new Array<number>(days).fill(0);
  for (const c of checks) {
    const t = new Date(c.createdAt).getTime();
    const i = Math.floor((t - start.getTime()) / 86_400_000);
    if (i >= 0 && i < days) out[i]! += 1;
  }
  return out;
}

export function buildScamNetwork(input: {
  data: Pick<CampaignSamplesData, 'campaignOf' | 'channelsOf'>;
  checks: readonly ScanRecord[];
  blocked: readonly BlockedEntry[];
  /** only checks and blocks before this moment count (the month scrubber) */
  until: Date;
  /** the month shown starts here (for "checks this month") */
  monthStart?: Date;
}): ScamNetwork {
  const { data, until } = input;
  const nodes = new Map<string, NetNode>();
  const edges: NetEdge[] = [];
  const add = (n: NetNode) => {
    nodes.set(n.id, n);
    return n;
  };
  const checks = input.checks.filter((c) => new Date(c.createdAt) < until);
  const blockedKeys = new Set(
    input.blocked.filter((b) => new Date(b.addedAt) < until).map((b) => keyOf(b.type, b.value)),
  );

  add({ id: CORE_ID, kind: 'core', key: CORE_ID });

  // campaigns and their details, from the sample indicators
  const campaigns = new Map<
    string,
    { node: NetNode; cats: Map<ScamCategory, number>; count: number }
  >();
  for (const ind of INDICATORS) {
    if (!ind.campaign) continue;
    let c = campaigns.get(ind.campaign);
    if (!c) {
      c = {
        node: add({
          id: `camp:${ind.campaign}`,
          kind: 'camp',
          key: ind.campaign,
          risk: 0,
          reports: 0,
          found: 0,
        }),
        cats: new Map(),
        count: 0,
      };
      campaigns.set(ind.campaign, c);
    }
    c.node.risk! += sampleRisk(ind.reports); // summed here, averaged below
    c.count += 1;
    c.node.reports! += ind.reports;
    if (ind.category) c.cats.set(ind.category, (c.cats.get(ind.category) ?? 0) + 1);
    const type = ind.type as DetailKind;
    const id = `det:${keyOf(type, ind.value)}`;
    add({
      id,
      kind: 'det',
      key: ind.value,
      detail: type,
      reports: ind.reports,
      blocked: blockedKeys.has(keyOf(type, ind.value)),
      mine: false,
      parent: c.node.id,
    });
    edges.push({ a: c.node.id, b: id, kind: 'detail' });
  }
  for (const { node, cats, count } of campaigns.values()) {
    // a campaign's risk is the average risk of its details
    node.risk = Math.round(node.risk! / Math.max(1, count));
    node.category = [...cats].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0];
  }

  // channels: how each campaign's kinds of scam arrived in the dataset
  const channelTotals = new Map<string, number>();
  for (const { node, cats } of campaigns.values()) {
    const mix = new Map<string, number>();
    for (const cat of cats.keys())
      for (const [ch, n] of Object.entries(data.channelsOf[cat] ?? {}))
        mix.set(ch, (mix.get(ch) ?? 0) + n);
    const total = [...mix.values()].reduce((a, n) => a + n, 0);
    for (const [ch, n] of mix) {
      if (!total || n / total < CHANNEL_MIN_SHARE) continue;
      const id = `chan:${ch}`;
      if (!nodes.has(id)) add({ id, kind: 'chan', key: ch, messages: 0 });
      edges.push({ a: node.id, b: id, kind: 'channel' });
    }
  }
  for (const counts of Object.values(data.channelsOf))
    for (const [ch, n] of Object.entries(counts ?? {}))
      channelTotals.set(ch, (channelTotals.get(ch) ?? 0) + n);
  for (const n of nodes.values()) if (n.kind === 'chan') n.messages = channelTotals.get(n.key) ?? 0;

  // your checks: which campaigns they belong to, and your own details
  const mineOutside = new Map<string, { node: NetNode; at: number }>();
  const ownDetailKeys = new Set<string>();
  let scams = 0;
  for (const check of checks) {
    const r = check.result;
    if (r.verdict === 'scam') scams += 1;
    const found = campaignOfResult(r, data);
    const camp = found?.campaign ? campaigns.get(found.campaign)?.node : undefined;
    if (camp) camp.found! += 1;
    const details: [DetailKind, string][] = [
      ...r.entities.upiIds.map((u) => ['upi', u.raw] as [DetailKind, string]),
      ...r.entities.phones.map((p) => ['phone', p.e164 ?? p.raw] as [DetailKind, string]),
      ...r.entities.urls
        .filter((u) => !u.isOfficial)
        .map((u) => ['domain', u.registrableDomain || u.host] as [DetailKind, string]),
    ];
    const at = new Date(check.createdAt).getTime();
    const inCampaigns = new Set<string>();
    for (const [type, value] of details) {
      const k = keyOf(type, value);
      ownDetailKeys.add(k);
      const det = nodes.get(`det:${k}`);
      if (det) {
        det.mine = true;
        inCampaigns.add(det.parent!);
        continue;
      }
      if (r.verdict === 'no_signs') continue;
      const prev = mineOutside.get(k);
      if (!prev || prev.at < at)
        mineOutside.set(k, {
          node: {
            id: `mine:${k}`,
            kind: 'mine',
            key: value,
            detail: type,
            blocked: blockedKeys.has(k),
          },
          at,
        });
    }
    // one check holding details of two campaigns links them (a shared detail)
    if (inCampaigns.size > 1) {
      for (const [type, value] of details) {
        const det = nodes.get(`det:${keyOf(type, value)}`);
        if (!det) continue;
        for (const other of inCampaigns)
          if (other !== det.parent && !edges.some((e) => e.a === other && e.b === det.id))
            edges.push({ a: other, b: det.id, kind: 'shared' });
      }
    }
  }
  for (const { node } of [...mineOutside.values()].sort((a, b) => b.at - a.at).slice(0, MINE_MAX)) {
    add(node);
    edges.push({ a: CORE_ID, b: node.id, kind: 'mine' });
  }
  for (const { node } of campaigns.values())
    edges.push({ a: CORE_ID, b: node.id, kind: node.found ? 'found' : 'core' });

  const dets = [...nodes.values()].filter((n) => n.kind === 'det');
  const blockedDets = dets.filter((n) => n.blocked).length;
  const monthStart = input.monthStart?.getTime() ?? -Infinity;
  return {
    nodes: [...nodes.values()],
    edges,
    stats: {
      checks: checks.length,
      scams,
      campaignsFound: [...campaigns.values()].filter((c) => c.node.found).length,
      blocked: blockedKeys.size,
      blockedPct: dets.length ? Math.round((blockedDets / dets.length) * 100) : 0,
      mineInCampaigns: dets.filter((n) => n.mine).length,
      thisMonth: checks.filter((c) => new Date(c.createdAt).getTime() >= monthStart).length,
    },
  };
}

/** Nodes linked to `id` (both directions). */
export function linkedTo(net: ScamNetwork, id: string): Set<string> {
  const out = new Set<string>();
  for (const e of net.edges) {
    if (e.a === id) out.add(e.b);
    if (e.b === id) out.add(e.a);
  }
  return out;
}

/**
 * Find a node for a typed question: a campaign or channel by any of its names, or a detail by its
 * value (digits are compared without spaces, so "98765 00001" finds +919876500001).
 */
export function findNode(
  net: ScamNetwork,
  query: string,
  names: (n: NetNode) => string[],
): NetNode | null {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return null;
  const digits = q.replace(/\D/g, '');
  const words = q.split(/\s+/).filter((w) => w.length >= 3);
  let best: { n: NetNode; score: number } | null = null;
  for (const n of net.nodes) {
    let score = 0;
    if (n.kind === 'det' || n.kind === 'mine') {
      const v = n.key.toLowerCase();
      // a query that looks like a value (a number, UPI ID or address) prefers details; a plain word
      // prefers a campaign's name, so "parcel" finds the campaign, not a site with "parcel" in it
      const valueLike = /[@./]/.test(q) || digits.length >= 6;
      if (v.includes(q)) score = valueLike ? 3 : 1;
      else if (digits.length >= 6 && v.replace(/\D/g, '').includes(digits)) score = 3;
    } else {
      for (const name of names(n).map((x) => x.toLowerCase())) {
        if (!name) continue;
        if (q.includes(name) || name.includes(q)) score = Math.max(score, 2);
        else if (words.some((w) => name.includes(w))) score = Math.max(score, 1);
      }
    }
    if (score && (!best || score > best.score)) best = { n, score };
  }
  return best?.n ?? null;
}
