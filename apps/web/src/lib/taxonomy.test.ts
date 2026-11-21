import { beforeAll, describe, expect, it } from 'vitest';
import type { CampaignSamplesData } from './campaignMatch';
import { loadCampaignSamples, SCAM_CATEGORIES } from './engine';
import {
  amountIn,
  buildTaxonomy,
  CARD_H,
  CARD_W,
  cardTypeOf,
  LEVERS,
  leverOf,
  PER_TRICK,
  trickIdOf,
} from './taxonomy';

let data: CampaignSamplesData;
beforeAll(async () => {
  data = await loadCampaignSamples();
});

describe('taxonomy', () => {
  it('puts every scam kind under exactly one lever', () => {
    const all = LEVERS.flatMap((l) => l.categories);
    expect(new Set(all).size).toBe(all.length);
    // every kind but the catch-all 'other', which the dataset never uses
    expect([...all].sort()).toEqual(SCAM_CATEGORIES.filter((c) => c !== 'other').sort());
    expect(leverOf('digital_arrest')).toBe('fear');
    expect(leverOf('job_task')).toBe('greed');
  });

  it('builds levers, tactics, tricks and real sample messages', () => {
    const tax = buildTaxonomy(data, 'en');
    const kinds = (k: string) => tax.nodes.filter((n) => n.kind === k);
    expect(kinds('lever')).toHaveLength(4);
    expect(kinds('tactic')).toHaveLength(SCAM_CATEGORIES.length - 1);
    expect(kinds('trick').length).toBeGreaterThanOrEqual(SCAM_CATEGORIES.length - 1);
    expect(tax.messages.length).toBeGreaterThan(100);
    // every message is a training sample of its kind and channel, and hangs from its trick
    const trickIds = new Set(kinds('trick').map((n) => n.id));
    for (const m of tax.messages) {
      expect(
        data.samples.some(
          ([c, l, t, ch]) => c === m.category && l === m.lang && t === m.text && ch === m.channel,
        ),
      ).toBe(true);
      expect(trickIds.has(trickIdOf(m))).toBe(true);
      expect(leverOf(m.category)).toBe(m.lever);
    }
    // at most PER_TRICK cards per trick; every link joins existing nodes
    const perTrick = new Map<string, number>();
    for (const m of tax.messages) perTrick.set(trickIdOf(m), (perTrick.get(trickIdOf(m)) ?? 0) + 1);
    expect(Math.max(...perTrick.values())).toBeLessThanOrEqual(PER_TRICK);
    const ids = new Set(tax.nodes.map((n) => n.id));
    for (const [a, b] of tax.links) expect(ids.has(a) && ids.has(b)).toBe(true);
  });

  it('prefers the person’s language, and is the same every time', () => {
    const hi = buildTaxonomy(data, 'hi');
    expect(hi.messages.filter((m) => m.lang === 'hi').length).toBeGreaterThan(
      buildTaxonomy(data, 'en').messages.filter((m) => m.lang === 'hi').length,
    );
    expect(buildTaxonomy(data, 'te')).toEqual(buildTaxonomy(data, 'te'));
  });

  it('keeps the cards apart where it can', () => {
    const { messages } = buildTaxonomy(data, 'en');
    let overlaps = 0;
    for (let i = 0; i < messages.length; i++)
      for (let j = i + 1; j < messages.length; j++) {
        const a = messages[i]!;
        const b = messages[j]!;
        if (Math.abs(a.x - b.x) < CARD_W && Math.abs(a.y - b.y) < CARD_H) overlaps += 1;
      }
    expect(overlaps).toBeLessThan(messages.length * 0.05);
  });

  it('picks card types and amounts', () => {
    expect(cardTypeOf('upi_collect', 'whatsapp')).toBe('upi');
    expect(cardTypeOf('qr_receive', 'whatsapp')).toBe('qr');
    expect(cardTypeOf('fake_kyc', 'sms')).toBe('sms');
    expect(cardTypeOf('digital_arrest', 'call')).toBe('call');
    expect(cardTypeOf('job_task', 'telegram')).toBe('chat');
    expect(amountIn('Pay ₹1,850 clearance')).toBe('₹1,850');
    expect(amountIn('pay Rs. 499 now')).toBe('₹499');
    expect(amountIn('no money here')).toBeNull();
  });
});
