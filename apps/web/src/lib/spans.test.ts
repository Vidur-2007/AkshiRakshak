import { describe, expect, it } from 'vitest';
import type { Signal } from './engine';
import { buildSegments, mergeSpans, rangeTone } from './spans';

function sig(
  id: Signal['id'],
  weight: number,
  spans: [number, number][],
  source: Signal['source'] = 'rule',
): Signal {
  return {
    id,
    weight,
    label: id,
    detail: id,
    source,
    spans: spans.map(([start, end]) => ({ start, end, text: '' })),
  };
}

const text = 'Your SBI account will be BLOCKED. Update KYC at http://sbi-kyc.xyz now';
//            0         1         2         3         4         5         6

describe('mergeSpans', () => {
  it('merges overlapping spans and lists every signal, strongest first', () => {
    const link = sig('SUSPICIOUS_LINK', 0.2, [[48, 66]]);
    const kyc = sig('BANK_IMPERSONATION', 0.3, [
      [40, 43],
      [56, 59],
    ]); // second span inside the link
    const ranges = mergeSpans(text.length, [link, kyc]);
    expect(ranges.map((r) => [r.start, r.end])).toEqual([
      [40, 43],
      [48, 66],
    ]);
    expect(ranges[1]!.signals.map((s) => s.id)).toEqual(['BANK_IMPERSONATION', 'SUSPICIOUS_LINK']);
    expect(ranges[1]!.weight).toBe(0.3);
  });

  it('merges touching spans but not separated ones', () => {
    const a = sig('URGENCY', 0.2, [
      [0, 4],
      [4, 8],
      [10, 12],
    ]);
    expect(mergeSpans(text.length, [a]).map((r) => [r.start, r.end])).toEqual([
      [0, 8],
      [10, 12],
    ]);
  });

  it('ranks ranges by weight for the underline draw order', () => {
    const weak = sig('URGENCY', 0.1, [[0, 4]]);
    const strong = sig('THREAT_BLOCK', 0.4, [[25, 32]]);
    const ranges = mergeSpans(text.length, [weak, strong]);
    expect(ranges.find((r) => r.start === 25)!.rank).toBe(0);
    expect(ranges.find((r) => r.start === 0)!.rank).toBe(1);
  });

  it('clamps and drops invalid spans', () => {
    const bad = sig('URGENCY', 0.2, [
      [-5, 3],
      [60, 999],
      [10, 10],
      [12, 8],
    ]);
    expect(mergeSpans(text.length, [bad]).map((r) => [r.start, r.end])).toEqual([
      [0, 3],
      [60, text.length],
    ]);
  });

  it('uses the strongest positive weight; negative only when nothing is risky', () => {
    const safe = sig('SAFETY_ADVICE', -0.3, [[0, 10]]);
    const warn = sig('URGENCY', 0.1, [[5, 12]]);
    expect(mergeSpans(text.length, [safe, warn])[0]!.weight).toBe(0.1);
    expect(mergeSpans(text.length, [safe])[0]!.weight).toBe(-0.3);
  });
});

describe('buildSegments', () => {
  it('covers the whole text exactly once, in order', () => {
    const segs = buildSegments(text, [
      sig('THREAT_BLOCK', 0.3, [[25, 32]]),
      sig('URGENCY', 0.2, [[67, 70]]),
    ]);
    expect(segs.map((s) => s.text).join('')).toBe(text);
    expect(segs.map((s) => s.kind)).toEqual(['plain', 'flag', 'plain', 'flag']);
    expect(segs[1]!.text).toBe('BLOCKED');
    for (let i = 1; i < segs.length; i++) expect(segs[i]!.start).toBe(segs[i - 1]!.end);
  });

  it('returns one plain segment without signals, and nothing for empty text', () => {
    expect(buildSegments('hello', [])).toEqual([
      { kind: 'plain', start: 0, end: 5, text: 'hello' },
    ]);
    expect(buildSegments('', [sig('URGENCY', 0.2, [[0, 3]])])).toEqual([]);
  });
});

describe('rangeTone', () => {
  it('maps weight and source to a tone', () => {
    expect(rangeTone({ weight: 0.3, signals: [sig('URGENCY', 0.3, [])] })).toBe('scam');
    expect(rangeTone({ weight: 0.1, signals: [sig('URGENCY', 0.1, [])] })).toBe('warn');
    expect(rangeTone({ weight: -0.2, signals: [sig('SAFETY_ADVICE', -0.2, [])] })).toBe('safe');
    expect(rangeTone({ weight: 0.3, signals: [sig('AI_FLAG', 0.3, [], 'ai')] })).toBe('ai');
  });
});
