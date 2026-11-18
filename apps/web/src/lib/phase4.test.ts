import { describe, expect, it } from 'vitest';
import { maxScore, scoreShare, tallyFlags } from './dojo';
import { toScanRecord } from './db';
import { analyze, buildEntityGraph, DRILLS, EVAL_REPORT } from './engine';
import { ALL_TYPES, filterGraph, neighbours, nodeValue, scansMentioning } from './graph';
import { isPlaceholderReport, orderedConfigs, pct, rowShares } from './proof';
import { maskUpi, maskUrl } from './share';
import { crossedThreshold, fibonacciSphere, mixHex, project, rotate } from './shieldMath';

const close = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThan(1e-9);

describe('ShieldCore maths', () => {
  it('spreads unit points over the sphere', () => {
    const pts = fibonacciSphere(500);
    expect(pts).toHaveLength(500);
    for (const p of pts) close(Math.hypot(p.x, p.y, p.z), 1);
    const meanY = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    expect(Math.abs(meanY)).toBeLessThan(1e-9);
  });

  it('rotates without changing length and projects the front larger', () => {
    const p = rotate({ x: 1, y: 0, z: 0 }, Math.PI / 2, 0.3);
    close(Math.hypot(p.x, p.y, p.z), 1);
    const front = project({ x: 0.5, y: 0, z: 1 }, 100, 100, 50);
    const back = project({ x: 0.5, y: 0, z: -1 }, 100, 100, 50);
    expect(front.scale).toBeGreaterThan(back.scale);
    expect(front.depth).toBe(1);
    expect(back.depth).toBe(0);
  });

  it('fires ring pulses only when crossing 40 and 70 upwards', () => {
    expect(crossedThreshold(20, 45)).toBe('warn');
    expect(crossedThreshold(45, 75)).toBe('scam');
    expect(crossedThreshold(10, 90)).toBe('scam');
    expect(crossedThreshold(50, 60)).toBeNull();
    expect(crossedThreshold(80, 30)).toBeNull();
  });

  it('mixes colours', () => {
    expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(mixHex('#3de0ff', '#ff3b5c', 0)).toBe('#3de0ff');
    expect(mixHex('#3de0ff', '#ff3b5c', 1)).toBe('#ff3b5c');
  });
});

describe('share masking', () => {
  it('masks UPI IDs like kyc.upd…@ybl', () => {
    expect(maskUpi('kyc.update.helpdesk@ybl')).toBe('kyc.upd…@ybl');
    expect(maskUpi('ab@ybl')).toBe('ab@ybl'); // too short to hide anything useful
    expect(maskUpi('refund.desk@ybl')).not.toContain('desk');
  });

  it('masks links to half the domain name, never the path', () => {
    const m = maskUrl('http://sbi-kyc-update.xyz/verify?id=88213');
    expect(m).toBe('sbi-kyc….xyz');
    expect(m).not.toContain('verify');
    expect(maskUrl('www.example.co.in/a')).toBe('exam….co.in');
  });
});

describe('Dojo logic', () => {
  const drill = DRILLS[0]!;

  it('finds the best possible score', () => {
    const max = maxScore(drill);
    expect(max).toBeGreaterThan(0);
    // a path exists that reaches it
    expect(max).toBeLessThanOrEqual(
      Object.values(drill.nodes).reduce(
        (s, n) => s + Math.max(0, ...(n.choices ?? []).map((c) => c.points)),
        0,
      ),
    );
  });

  it('is cycle-safe', () => {
    const loop = {
      ...drill,
      start: 'a',
      nodes: {
        a: {
          id: 'a',
          from: 'them' as const,
          text: { en: 'a' },
          choices: [{ id: 'x', text: { en: 'x' }, next: 'b', points: 3, feedback: { en: '' } }],
        },
        b: {
          id: 'b',
          from: 'them' as const,
          text: { en: 'b' },
          choices: [{ id: 'y', text: { en: 'y' }, next: 'a', points: 2, feedback: { en: '' } }],
        },
      },
    };
    expect(maxScore(loop)).toBe(5);
  });

  it('tallies caught and missed red flags', () => {
    const t = tallyFlags([
      {
        id: '1',
        text: { en: '' },
        next: 'x',
        points: 10,
        feedback: { en: '' },
        redFlag: 'LOOKALIKE_DOMAIN',
      },
      {
        id: '2',
        text: { en: '' },
        next: 'x',
        points: 0,
        feedback: { en: '' },
        redFlag: 'ASKS_OTP',
      },
      { id: '3', text: { en: '' }, next: 'x', points: 0, feedback: { en: '' } },
    ]);
    expect(t).toEqual({ caught: ['LOOKALIKE_DOMAIN'], missed: ['ASKS_OTP'] });
    expect(scoreShare(5, 20)).toBe(0.25);
    expect(scoreShare(5, 0)).toBe(0);
  });
});

describe('network helpers', () => {
  const g = buildEntityGraph([], { includeBundled: true });

  it('filters by type and "only mine" (keeping linked campaigns)', () => {
    const phones = filterGraph(g, { types: new Set(['phone']), onlyMine: false });
    expect(phones.nodes.every((n) => n.type === 'phone')).toBe(true);
    const mine = filterGraph(g, { types: new Set(ALL_TYPES), onlyMine: true });
    expect(mine.nodes.filter((n) => n.type !== 'campaign').every((n) => n.mine)).toBe(true);
    const ids = new Set(mine.nodes.map((n) => n.id));
    expect(mine.edges.every((e) => ids.has(String(e.source)) && ids.has(String(e.target)))).toBe(
      true,
    );
  });

  it('finds neighbours and scans that mention a node', async () => {
    const node = g.nodes.find((n) => n.type === 'domain')!;
    expect(neighbours(g, node.id).size).toBeGreaterThan(0);
    const r = await analyze({
      kind: 'message',
      text: `Update KYC at http://${nodeValue(node)}/verify now`,
      lang: 'en',
    });
    expect(scansMentioning([toScanRecord(r)], node)).toHaveLength(1);
  });
});

describe('proof helpers', () => {
  it('flags the placeholder report and orders the ablation', () => {
    expect(isPlaceholderReport(EVAL_REPORT)).toBe(true);
    expect(isPlaceholderReport({ notes: ['Measured on the synthetic test split.'] })).toBe(false);
    expect(orderedConfigs(EVAL_REPORT).map((c) => c.name)).toEqual([
      'rules_only',
      'rules_model',
      'full_no_ai',
      'full_ai_sample',
    ]);
  });

  it('formats percentages and row shares', () => {
    expect(pct(0.925)).toBe('93%');
    expect(pct(0.925, 1)).toBe('92.5%');
    expect(
      rowShares([
        [3, 1],
        [0, 0],
      ]),
    ).toEqual([
      [0.75, 0.25],
      [0, 0],
    ]);
  });
});
