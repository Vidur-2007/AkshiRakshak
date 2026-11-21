import { beforeAll, describe, expect, it } from 'vitest';
import type { CampaignSamplesData } from './campaignMatch';
import { toScanRecord, type ScanRecord } from './db';
import { analyze, INDICATORS, loadCampaignSamples } from './engine';
import {
  buildScamNetwork,
  CORE_ID,
  dailyActivity,
  findNode,
  linkedTo,
  monthEnd,
  recentMonths,
  type NetNode,
} from './scamNetwork';

const KYC =
  'Dear Customer, your SBI account will be BLOCKED today due to pending KYC. Update KYC immediately at http://sbi-kyc-update.xyz/verify or call our helpline 98765 00001. -SBI Team';
const NOW = new Date(2026, 10, 21, 12); // 21 Nov 2026
const UNTIL = monthEnd('2026-11');

let data: CampaignSamplesData;
beforeAll(async () => {
  data = await loadCampaignSamples();
});

async function check(text: string, at: Date): Promise<ScanRecord> {
  const r = await analyze({ kind: 'message', text, lang: 'en' });
  return { ...toScanRecord(r), createdAt: at.toISOString() };
}
const node = (net: ReturnType<typeof buildScamNetwork>, id: string) =>
  net.nodes.find((n) => n.id === id);

describe('buildScamNetwork', () => {
  it('draws the sample campaigns, their details and channels around your checks', () => {
    const net = buildScamNetwork({ data, checks: [], blocked: [], until: UNTIL });
    const kinds = (k: NetNode['kind']) => net.nodes.filter((n) => n.kind === k);
    expect(kinds('core')).toHaveLength(1);
    const campaigns = new Set(INDICATORS.map((i) => i.campaign).filter(Boolean));
    expect(kinds('camp')).toHaveLength(campaigns.size);
    expect(kinds('det')).toHaveLength(INDICATORS.filter((i) => i.campaign).length);
    // channels come from the dataset; each is used by a campaign and counts real messages
    const chans = kinds('chan');
    expect(chans.map((c) => c.key)).toEqual(expect.arrayContaining(['sms', 'whatsapp', 'call']));
    for (const c of chans) {
      expect(c.messages).toBeGreaterThan(0);
      expect(net.edges.some((e) => e.b === c.id && e.kind === 'channel')).toBe(true);
    }
    for (const c of kinds('camp')) {
      expect(c.risk).toBeGreaterThanOrEqual(70);
      expect(c.risk).toBeLessThanOrEqual(100);
      expect(c.category).toBeTruthy();
    }
    for (const d of kinds('det')) expect(node(net, d.parent!)?.kind).toBe('camp');
    // nothing found yet: the links from your checks are the faint kind, and the stats are zero
    expect(net.edges.filter((e) => e.a === CORE_ID).every((e) => e.kind === 'core')).toBe(true);
    expect(net.stats).toMatchObject({ checks: 0, scams: 0, campaignsFound: 0, blocked: 0 });
  });

  it('links a check to its campaign and marks your own details', async () => {
    const net = buildScamNetwork({
      data,
      checks: [await check(KYC, NOW)],
      blocked: [],
      until: UNTIL,
      monthStart: new Date(2026, 10, 1),
    });
    const kyc = node(net, 'camp:kyc-block-wave')!;
    expect(kyc.found).toBe(1);
    expect(net.edges).toContainEqual({ a: CORE_ID, b: kyc.id, kind: 'found' });
    expect(node(net, 'det:domain:sbi-kyc-update.xyz')?.mine).toBe(true);
    expect(node(net, 'det:phone:+919876500001')?.mine).toBe(true);
    expect(net.stats).toMatchObject({
      checks: 1,
      scams: 1,
      campaignsFound: 1,
      mineInCampaigns: 2,
      thisMonth: 1,
    });
  });

  it('only counts checks and blocks from before the month shown ends', async () => {
    const later = await check(KYC, new Date(2026, 11, 2)); // December
    const net = buildScamNetwork({
      data,
      checks: [later],
      blocked: [{ value: 'sbi-kyc-update.xyz', type: 'domain', addedAt: '2026-12-03T00:00:00Z' }],
      until: UNTIL,
    });
    expect(net.stats.checks).toBe(0);
    expect(node(net, 'det:domain:sbi-kyc-update.xyz')?.blocked).toBe(false);
  });

  it('marks blocked details and counts the share blocked', () => {
    const net = buildScamNetwork({
      data,
      checks: [],
      blocked: [
        { value: 'SBI-KYC-update.xyz', type: 'domain', addedAt: '2026-11-01T00:00:00Z' },
        { value: '+91 98765 00001', type: 'phone', addedAt: '2026-11-01T00:00:00Z' },
      ],
      until: UNTIL,
    });
    expect(node(net, 'det:domain:sbi-kyc-update.xyz')?.blocked).toBe(true);
    expect(node(net, 'det:phone:+919876500001')?.blocked).toBe(true);
    const dets = net.nodes.filter((n) => n.kind === 'det').length;
    expect(net.stats.blocked).toBe(2);
    expect(net.stats.blockedPct).toBe(Math.round((2 / dets) * 100));
  });

  it('hangs your risky details outside any campaign off your checks', async () => {
    const net = buildScamNetwork({
      data,
      checks: [
        await check(
          'URGENT: your account is blocked. Pay Rs 99 penalty now to unlock.verify.fee@okicici or call 9123456780 immediately',
          NOW,
        ),
      ],
      blocked: [],
      until: UNTIL,
    });
    const mine = net.nodes.filter((n) => n.kind === 'mine');
    expect(mine.length).toBeGreaterThan(0);
    for (const m of mine) expect(net.edges).toContainEqual({ a: CORE_ID, b: m.id, kind: 'mine' });
  });

  it('links two campaigns when one check holds details of both', async () => {
    const refundUpi = INDICATORS.find((i) => i.campaign === 'refund-collect' && i.type === 'upi')!;
    const net = buildScamNetwork({
      data,
      checks: [
        await check(
          `Your SBI KYC is pending, update at http://sbi-kyc-update.xyz/verify. For your refund approve the request from ${refundUpi.value} and enter UPI PIN.`,
          NOW,
        ),
      ],
      blocked: [],
      until: UNTIL,
    });
    expect(net.edges.some((e) => e.kind === 'shared')).toBe(true);
  });
});

describe('months and activity', () => {
  it('lists the six months ending now and where each ends', () => {
    expect(recentMonths(NOW)).toEqual([
      '2026-06',
      '2026-07',
      '2026-08',
      '2026-09',
      '2026-10',
      '2026-11',
    ]);
    expect(recentMonths(new Date(2027, 1, 3), 3)).toEqual(['2026-12', '2027-01', '2027-02']);
    expect(monthEnd('2026-11').getTime()).toBe(new Date(2026, 11, 1).getTime());
    expect(monthEnd('2026-12').getTime()).toBe(new Date(2027, 0, 1).getTime());
  });

  it('counts checks per day across the months', async () => {
    const months = recentMonths(NOW);
    const r = await check(KYC, NOW);
    const days = dailyActivity(
      [r, { ...r, createdAt: new Date(2026, 5, 1, 9).toISOString() }],
      months,
    );
    expect(days.length).toBeGreaterThanOrEqual(180);
    expect(days[0]).toBe(1); // 1 June
    expect(days.reduce((a, n) => a + n, 0)).toBe(2);
  });
});

describe('findNode and linkedTo', () => {
  it('finds campaigns by name and details by value or digits', () => {
    const net = buildScamNetwork({ data, checks: [], blocked: [], until: UNTIL });
    const names = (n: NetNode) => (n.kind === 'camp' ? [n.key.replace(/-/g, ' ')] : [n.key]);
    expect(findNode(net, 'tell me about the kyc block wave', names)?.id).toBe(
      'camp:kyc-block-wave',
    );
    expect(findNode(net, '98765 00001', names)?.id).toBe('det:phone:+919876500001');
    expect(findNode(net, 'sbi-kyc-update', names)?.id).toBe('det:domain:sbi-kyc-update.xyz');
    expect(findNode(net, 'x', names)).toBeNull();
    expect(linkedTo(net, 'camp:kyc-block-wave').has(CORE_ID)).toBe(true);
  });
});
