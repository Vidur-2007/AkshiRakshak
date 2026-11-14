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
