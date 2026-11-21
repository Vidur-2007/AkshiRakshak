import { describe, expect, it } from 'vitest';
import { maxScore, scoreShare, tallyFlags } from './dojo';
import { DRILLS, EVAL_REPORT } from './engine';
import { isPlaceholderReport, orderedConfigs, pct, rowShares } from './proof';
import { maskUpi, maskUrl } from './share';

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

describe('proof helpers', () => {
  it('flags a placeholder report, not the measured one, and orders the ablation', () => {
    expect(isPlaceholderReport({ notes: ['PLACEHOLDER: not measured'] })).toBe(true);
    // since Merge 2 the bundled report is a real measurement (C's eval harness on the real engine)
    expect(isPlaceholderReport(EVAL_REPORT)).toBe(false);
    expect(isPlaceholderReport({ notes: ['Measured on the synthetic test split.'] })).toBe(false);
    const configs = (names: string[]) =>
      ({ configs: names.map((name) => ({ name })) }) as unknown as Parameters<
        typeof orderedConfigs
      >[0];
    expect(
      orderedConfigs(configs(['full_ai_sample', 'full_no_ai', 'rules_only', 'rules_model'])).map(
        (c) => c.name,
      ),
    ).toEqual(['rules_only', 'rules_model', 'full_no_ai', 'full_ai_sample']);
    // the bundled report has the configurations that were run (full_ai_sample only after the AI sample run)
    const order = ['rules_only', 'rules_model', 'full_no_ai', 'full_ai_sample'];
    const bundled = orderedConfigs(EVAL_REPORT).map((c) => c.name);
    expect(bundled).toEqual(order.filter((n) => bundled.includes(n as (typeof bundled)[number])));
    expect(bundled).toEqual(expect.arrayContaining(['rules_only', 'rules_model', 'full_no_ai']));
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
