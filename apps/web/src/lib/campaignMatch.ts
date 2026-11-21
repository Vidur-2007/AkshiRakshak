/**
 * Campaign Match ("You're not the only one"): connects one checked message to the scam campaigns
 * in Akshi's sample data and the Network view.
 *
 * Evidence, strongest first:
 * 1. a UPI ID, phone number or website in the message is one of a campaign's sample indicators;
 * 2. otherwise the engine's scam category, mapped to the campaign most of its indicators belong to.
 * The count is a plain fact about the synthetic dataset (messages of this kind), and the closest
 * example is the most similar training message of the same kind (character trigram TF-IDF,
 * cosine). Nothing here says "reported": it is all sample data and is labelled so.
 */
import {
  lookupIndicator,
  type AnalysisResult,
  type IndicatorMatch,
  type ScamCategory,
} from './engine';

/** Shape of @akshi/content's campaign-samples.json (packages/content/src/campaignSamples.ts). */
export interface CampaignSamplesData {
  campaignOf: Partial<Record<ScamCategory, string>>;
  counts: Partial<Record<ScamCategory, { messages: number; langs: number }>>;
  /** channel → scam messages of the category that arrived that way (sms, whatsapp, call, …) */
  channelsOf: Partial<Record<ScamCategory, Record<string, number>>>;
  /** [category, lang, text], training split only */
  samples: [ScamCategory, string, string][];
}

export interface SharedDetail {
  type: IndicatorMatch['type'];
  value: string;
}

export interface CampaignMatch {
  category: ScamCategory;
  /** network campaign id ("kyc-block-wave"), or null when no campaign has this kind of scam */
  campaign: string | null;
  /** details of this message that are also in the campaign's sample data */
  shared: SharedDetail[];
  /** scam messages of this category in the dataset, and in how many languages */
  messages: number;
  langs: number;
  closest: { text: string; lang: string } | null;
}

/** Below this cosine the "closest" example is not really alike; tuned on the validation split. */
export const CLOSEST_MIN = 0.15;

type Result = Pick<AnalysisResult, 'verdict' | 'category' | 'text' | 'entities'>;

/** Sample indicators found in the message, with the campaign each belongs to. */
export function campaignHits(result: Result): { detail: SharedDetail; match: IndicatorMatch }[] {
  const hits: { detail: SharedDetail; match: IndicatorMatch }[] = [];
  const add = (
    type: SharedDetail['type'],
    value: string,
    match: IndicatorMatch | null | undefined,
  ) => {
    if (match?.campaign && match.source === 'bundled')
      hits.push({ detail: { type, value }, match });
  };
  for (const u of result.entities.upiIds) add('upi', u.raw, u.indicator);
  for (const p of result.entities.phones) add('phone', p.e164 ?? p.raw, p.indicator);
  for (const u of result.entities.urls) {
    if (u.isOfficial) continue;
    const domain = u.registrableDomain || u.host;
    add('domain', domain, lookupIndicator(domain));
  }
  return hits;
}

// ── similarity ──────────────────────────────────────────────────────────────

const norm = (t: string) => t.toLowerCase().replace(/\d/g, '0').replace(/\s+/g, ' ');

function grams(text: string): Map<string, number> {
  const t = ` ${norm(text)} `;
  const g = new Map<string, number>();
  for (let i = 0; i + 3 <= t.length; i++) {
    const k = t.slice(i, i + 3);
    g.set(k, (g.get(k) ?? 0) + 1);
  }
  return g;
}

interface Index {
  idf: Map<string, number>;
  unseen: number;
  vectors: Map<string, number>[];
}
const indexes = new WeakMap<CampaignSamplesData, Index>();

function vector(g: Map<string, number>, ix: Pick<Index, 'idf' | 'unseen'>): Map<string, number> {
  const v = new Map<string, number>();
  let sum = 0;
  for (const [k, c] of g) {
    const w = c * (ix.idf.get(k) ?? ix.unseen);
    v.set(k, w);
    sum += w * w;
  }
  const n = Math.sqrt(sum) || 1;
  for (const [k, w] of v) v.set(k, w / n);
  return v;
}

function indexOf(data: CampaignSamplesData): Index {
  const cached = indexes.get(data);
  if (cached) return cached;
  const all = data.samples.map(([, , text]) => grams(text));
  const df = new Map<string, number>();
  for (const g of all) for (const k of g.keys()) df.set(k, (df.get(k) ?? 0) + 1);
  const n = all.length;
  const idf = new Map<string, number>();
  for (const [k, d] of df) idf.set(k, Math.log((n + 1) / (d + 1)) + 1);
  const base = { idf, unseen: Math.log(n + 1) + 1 };
  const ix: Index = { ...base, vectors: all.map((g) => vector(g, base)) };
  indexes.set(data, ix);
  return ix;
}

function cosine(a: Map<string, number>, b: Map<string, number>): number {
  const [small, large] = a.size < b.size ? [a, b] : [b, a];
  let dot = 0;
  for (const [k, w] of small) dot += w * (large.get(k) ?? 0);
  return dot;
}

/** The most alike training sample of a category, when it is alike enough. */
export function closestSample(
  text: string,
  category: ScamCategory,
  data: CampaignSamplesData,
): { text: string; lang: string; similarity: number } | null {
  const ix = indexOf(data);
  const q = vector(grams(text), ix);
  let best = -1;
  let score = 0;
  data.samples.forEach(([c], i) => {
    if (c !== category) return;
    const s = cosine(q, ix.vectors[i]!);
    if (s > score) {
      score = s;
      best = i;
    }
  });
  if (best < 0 || score < CLOSEST_MIN) return null;
  const [, lang, sample] = data.samples[best]!;
  return { text: sample, lang, similarity: score };
}

// ── match ───────────────────────────────────────────────────────────────────

/**
 * The campaign a result belongs to, without the closest-example search (cheap enough for every
 * check in the history): a campaign that holds the most of the message's details, otherwise the
 * campaign mapped from the engine's category. Null for "No warning signs found".
 */
export function campaignOfResult(
  result: Result,
  data: Pick<CampaignSamplesData, 'campaignOf'>,
): { campaign: string | null; category: ScamCategory | null; shared: SharedDetail[] } | null {
  if (result.verdict === 'no_signs') return null;
  const hits = campaignHits(result);
  let campaign: string | null = null;
  let category = result.category ?? null;
  if (hits.length) {
    const votes = new Map<string, number>();
    for (const h of hits) votes.set(h.match.campaign!, (votes.get(h.match.campaign!) ?? 0) + 1);
    campaign = [...votes].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]![0];
    category ??= hits.find((h) => h.match.campaign === campaign)?.match.category ?? null;
  } else if (category) {
    campaign = data.campaignOf[category] ?? null;
  }
  const shared = hits.filter((h) => h.match.campaign === campaign).map((h) => h.detail);
  return {
    campaign,
    category,
    shared: shared.filter((d, i) => shared.findIndex((x) => x.value === d.value) === i),
  };
}

/** Campaign Match for a result, or null when there is nothing honest to connect it to. */
export function matchCampaign(result: Result, data: CampaignSamplesData): CampaignMatch | null {
  const found = campaignOfResult(result, data);
  if (!found?.category) return null;
  const { campaign, category, shared } = found;
  const count = data.counts[category];
  if (!count) return null;
  const closest = result.text ? closestSample(result.text, category, data) : null;
  return {
    category,
    campaign,
    shared,
    messages: count.messages,
    langs: count.langs,
    closest: closest && { text: closest.text, lang: closest.lang },
  };
}
