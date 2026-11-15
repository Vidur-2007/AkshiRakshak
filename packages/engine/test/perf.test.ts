/**
 * scoreLive micro-benchmark (SPEC.md §6.5, SPEC_A_ENGINE.md §14): < 5 ms per 1,000 characters.
 * Measured as the median of many runs after warm-up, on mixed-script scam text.
 */
import { describe, expect, it } from 'vitest';
import { scoreLive, warmup } from '../src/index';

const SAMPLE = [
  'Dear SBI customer, your account will be blocked today. Update KYC immediately at http://sbi-kyc-update.xyz and share the OTP.',
  'आपका खाता बंद हो जाएगा, तुरंत KYC अपडेट करें और OTP बताएं। किसी को मत बताना।',
  'మీ ఖాతా ఈరోజే బ్లాక్ అవుతుంది. వెంటనే OTP చెప్పండి. 98765 00001 కు కాల్ చేయండి.',
  'আপনার অ্যাকাউন্ট আজই ব্লক হয়ে যাবে। এখনই OTP পাঠান। কাউকে বলবেন না।',
  'Aapka khata band ho jayega, turant otp bhejo. Ghar baithe kamao ₹3,000 roz!',
].join(' ');

function textOf(len: number): string {
  let t = '';
  while (t.length < len) t += `${SAMPLE} `;
  return t.slice(0, len);
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] ?? 0;
}

describe('scoreLive performance', () => {
  it('scores 1,000 characters in under 5 ms', async () => {
    await warmup();
    const text = textOf(1000);
    for (let i = 0; i < 30; i++) scoreLive(text);
    const times: number[] = [];
    for (let i = 0; i < 200; i++) {
      const t0 = performance.now();
      scoreLive(text);
      times.push(performance.now() - t0);
    }
    const m = median(times);
    console.log(`scoreLive median ${m.toFixed(3)} ms for 1,000 chars`);
    expect(m).toBeLessThan(5);
  });

  it('scales roughly linearly (2,000 chars under 10 ms)', () => {
    const text = textOf(2000);
    const times: number[] = [];
    for (let i = 0; i < 100; i++) {
      const t0 = performance.now();
      scoreLive(text);
      times.push(performance.now() - t0);
    }
    expect(median(times)).toBeLessThan(10);
  });
});

/**
 * analyze() p95 (SPEC_A_ENGINE.md §14): text ≤ 2,000 chars, model loaded, offline → < 150 ms.
 * 200 messages: C's validation texts when packages/model/test/parity-fixtures.json exists,
 * otherwise the synthetic corpus. Model: C's real model when loadModel() returns one, otherwise
 * a proxy with the same featuriser and feature count (test/support/proxy-model.ts).
 */
describe('analyze performance', () => {
  it('p95 under 150 ms on 200 messages with the model loaded', async () => {
    const { loadModel } = await import('@akshi/model');
    const { __setModel } = await import('../src/model');
    const { analyze } = await import('../src/index');
    const { syntheticCorpus, validationCorpus } = await import('./support/bench-corpus');
    const { proxyModel } = await import('./support/proxy-model');

    const validation = await validationCorpus(200);
    const corpus = validation ?? syntheticCorpus(200);
    const real = await loadModel().catch(() => null);
    const model = real ?? proxyModel(corpus.map((r) => r.text ?? ''));
    __setModel(model);
    const opts = { expandLinks: false, domainAge: false, cloudAI: false } as const;
    try {
      for (const r of corpus.slice(0, 20)) await analyze({ ...r, options: opts });
      const times: number[] = [];
      const stageMs = new Map<string, number[]>();
      for (const r of corpus) {
        const t0 = performance.now();
        const res = await analyze({ ...r, options: opts });
        times.push(performance.now() - t0);
        expect(res.layers.find((l) => l.layer === 'model')?.available).toBe(true);
        for (const s of res.stages)
          if (s.status === 'done') stageMs.set(s.stage, [...(stageMs.get(s.stage) ?? []), s.ms]);
      }
      const q = (xs: number[], p: number) =>
        [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(p * xs.length))] ?? 0;
      const stages = [...stageMs].map(([s, xs]) => `${s} ${q(xs, 0.95).toFixed(1)}`).join(', ');
      console.log(
        `analyze n=${times.length} corpus=${validation ? 'validation' : 'synthetic'} ` +
          `model=${model.version}: p50 ${q(times, 0.5).toFixed(1)} ms, ` +
          `p95 ${q(times, 0.95).toFixed(1)} ms, max ${Math.max(...times).toFixed(1)} ms ` +
          `(stage p95 ms: ${stages})`,
      );
      expect(times).toHaveLength(200);
      expect(q(times, 0.95)).toBeLessThan(150);
    } finally {
      const { resetModelCache } = await import('../src/model');
      resetModelCache();
    }
  }, 60_000);
});
