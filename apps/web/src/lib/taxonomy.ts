/**
 * The scam taxonomy wall (Network page, design "Scam taxonomy · Network V3", 2026-11-21): every scam
 * message traced back to the one lever it pulls (fear, trust, greed, urgency).
 *
 * - levers → tactics: Akshi's 19 scam kinds, grouped by the lever each mainly pulls (an editorial
 *   grouping; the detail panel shows what the engine actually finds in each message);
 * - tactics → tricks: the channels that kind arrived through in the dataset (≥ 10% of its messages);
 * - tricks → messages: real sample texts from the synthetic dataset's training split, in the
 *   person's language first. No invented senders or texts.
 *
 * Pure and seeded: the same wall every visit. Drawn by components/network/TaxonomyCanvas.tsx.
 */
import type { CampaignSamplesData } from './campaignMatch';
import { rng } from './cosmic';
import type { Lang, ScamCategory } from './engine';

export type LeverId = 'fear' | 'trust' | 'greed' | 'urgency';

export interface Lever {
  id: LeverId;
  color: string;
  /** direction from the centre */
  angle: number;
  categories: ScamCategory[];
}

export const LEVERS: readonly Lever[] = [
  {
    id: 'fear',
    color: '#ff3b5c',
    angle: -Math.PI / 2,
    categories: ['fake_kyc', 'digital_arrest', 'bill_disconnection', 'impersonation_govt'],
  },
  {
    id: 'trust',
    color: '#3de0ff',
    angle: 0,
    categories: [
      'fake_customer_care',
      'courier_customs',
      'phishing_link',
      'remote_access',
      'romance',
    ],
  },
  {
    id: 'greed',
    color: '#f5a524',
    angle: Math.PI / 2,
    categories: ['lottery_prize', 'job_task', 'investment_crypto', 'loan_app', 'refund_cashback'],
  },
  {
    id: 'urgency',
    color: '#b4a3f0',
    angle: Math.PI,
    categories: ['otp_theft', 'upi_collect', 'qr_receive', 'wrong_transfer', 'malicious_apk'],
  },
];

export type CardType = 'sms' | 'chat' | 'call' | 'email' | 'upi' | 'qr';

export interface TaxNode {
  id: string;
  kind: 'lever' | 'tactic' | 'trick';
  lever: LeverId;
  category?: ScamCategory;
  channel?: string;
  x: number;
  y: number;
}

export interface TaxMessage {
  id: string;
  lever: LeverId;
  category: ScamCategory;
  channel: string;
  lang: string;
  text: string;
  card: CardType;
  /** 0–3: small visual variation between cards of one trick */
  v: number;
  x: number;
  y: number;
  rot: number;
}

export interface Taxonomy {
  nodes: TaxNode[];
  links: [string, string][];
  messages: TaxMessage[];
}

/** A channel is a trick of a kind when at least this share of the kind's messages used it. */
export const TRICK_MIN_SHARE = 0.1;
/** Message cards per trick. */
export const PER_TRICK = 4;
/** Card size in world units (the canvas scales them). */
export const CARD_W = 92;
export const CARD_H = 118;

export const leverOf = (category: ScamCategory): LeverId | null =>
  LEVERS.find((l) => l.categories.includes(category))?.id ?? null;

export function cardTypeOf(category: ScamCategory, channel: string): CardType {
  if (category === 'upi_collect') return 'upi';
  if (category === 'qr_receive') return 'qr';
  if (channel === 'sms') return 'sms';
  if (channel === 'call') return 'call';
  if (channel === 'email') return 'email';
  return 'chat';
}

export function buildTaxonomy(
  data: Pick<CampaignSamplesData, 'samples' | 'channelsOf'>,
  lang: Lang,
  perTrick = PER_TRICK,
): Taxonomy {
  const r = rng(21);
  const nodes: TaxNode[] = [];
  const links: [string, string][] = [];
  const messages: TaxMessage[] = [];
  // the person's language first, then English, then the rest; dataset order otherwise
  const rank = (l: string) => (l === lang ? 0 : l === 'en' ? 1 : 2);
  const indexed = data.samples.map((s, i) => ({ s, i }));

  for (const L of LEVERS) {
    const leverId = `lever:${L.id}`;
    nodes.push({
      id: leverId,
      kind: 'lever',
      lever: L.id,
      x: Math.cos(L.angle) * 190,
      y: Math.sin(L.angle) * 190,
    });
    const n = L.categories.length;
    L.categories.forEach((category, ti) => {
      // 0.33 rad apart: five kinds fill most of a lever's quarter without meeting the next lever's
      const a = L.angle + (ti - (n - 1) / 2) * 0.33;
      const tr = ti % 2 ? 610 : 450;
      const tacticId = `tactic:${category}`;
      nodes.push({
        id: tacticId,
        kind: 'tactic',
        lever: L.id,
        category,
        x: Math.cos(a) * tr,
        y: Math.sin(a) * tr,
      });
      links.push([leverId, tacticId]);
      const mix = Object.entries(data.channelsOf[category] ?? {});
      const total = mix.reduce((acc, [, k]) => acc + k, 0);
      const channels = mix
        .filter(([, k]) => total && k / total >= TRICK_MIN_SHARE)
        .sort((p, q) => q[1] - p[1] || p[0].localeCompare(q[0]))
        .slice(0, 3)
        .map(([ch]) => ch);
      channels.forEach((channel, ki) => {
        const a2 = a + (ki - (channels.length - 1) / 2) * 0.17;
        const trickId = `trick:${category}:${channel}`;
        const trick: TaxNode = {
          id: trickId,
          kind: 'trick',
          lever: L.id,
          category,
          channel,
          x: Math.cos(a2) * 760,
          y: Math.sin(a2) * 760,
        };
        nodes.push(trick);
        links.push([tacticId, trickId]);
        indexed
          .filter(({ s }) => s[0] === category && s[3] === channel)
          .sort((p, q) => rank(p.s[1]) - rank(q.s[1]) || p.i - q.i)
          .slice(0, perTrick)
          .forEach(({ s, i }, v) =>
            messages.push({
              id: `msg:${i}`,
              lever: L.id,
              category,
              channel,
              lang: s[1],
              text: s[2],
              card: cardTypeOf(category, channel),
              v,
              x: trick.x,
              y: trick.y,
              rot: 0,
            }),
          );
      });
    });
  }

  // place the cards in their trick's direction, out at the edge, keeping them apart
  const placed: { x: number; y: number }[] = [];
  for (const m of messages) {
    const base = Math.atan2(m.y, m.x);
    let at: { x: number; y: number } | null = null;
    for (let tries = 0; tries < 80 && !at; tries++) {
      const a = base + (r() - 0.5) * 0.55;
      const rad = 1000 + r() * 560;
      const p = { x: Math.cos(a) * rad, y: Math.sin(a) * rad * 0.82 };
      if (
        placed.every((o) => Math.abs(o.x - p.x) > CARD_W + 16 || Math.abs(o.y - p.y) > CARD_H + 16)
      )
        at = p;
    }
    if (!at) {
      const a = base + (r() - 0.5) * 0.8;
      const rad = 1560 + r() * 240;
      at = { x: Math.cos(a) * rad, y: Math.sin(a) * rad * 0.82 };
    }
    placed.push(at);
    m.x = at.x;
    m.y = at.y;
    m.rot = (r() - 0.5) * 0.06;
  }
  return { nodes, links, messages };
}

/** The trick a message hangs from. */
export const trickIdOf = (m: Pick<TaxMessage, 'category' | 'channel'>) =>
  `trick:${m.category}:${m.channel}`;

/** First amount in a text (₹1,850 / Rs 499 / INR 2,000), for the UPI and QR cards. */
export function amountIn(text: string): string | null {
  const m = /(?:₹|rs\.?|inr)\s?(\d[\d,]*(?:\.\d+)?)/i.exec(text);
  return m ? `₹${m[1]}` : null;
}
