import { describe, expect, it } from 'vitest';
import { normalizeText } from '@akshi/contracts';
import { loadModel } from '../src/index';

// this package compiles without DOM or Node typings; both runtimes provide these two globals
declare const performance: { now(): number };
declare const console: { info(message: string): void };

/** SPEC_C_DATA.md §4.4: predict ≤ 10 ms for 2,000 characters on a laptop. */
describe('predict speed', () => {
  it('takes at most 10 ms (median) for a 2,000-character message', async () => {
    const model = (await loadModel())!;
    const parts = [
      'Dear Customer, your SBI account will be blocked today due to pending KYC. Update at http://sbi-kyc-update.xyz/verify ',
      'आपका खाता बंद हो जाएगा। तुरंत केवाईसी पूरी करें और ओटीपी किसी को न बताएं। ',
      'మీ ఖాతా బ్లాక్ అవుతుంది, వెంటనే కాల్ చేయండి 98765 00001. ',
      'আপনার রিফান্ড মঞ্জুর হয়েছে, পিন দিন 🎁 ',
    ];
    let raw = '';
    for (let i = 0; raw.length < 2000; i++) raw += parts[i % parts.length];
    const text = normalizeText(raw).slice(0, 2000);
    expect(text.length).toBe(2000);

    for (let i = 0; i < 20; i++) model.predict(text); // warm up
    const times: number[] = [];
    for (let i = 0; i < 50; i++) {
      const t0 = performance.now();
      model.predict(text);
      times.push(performance.now() - t0);
    }
    times.sort((a, b) => a - b);
    const median = times[25]!;
    console.info(`predict 2,000 chars: median ${median.toFixed(2)} ms, p95 ${times[47]!.toFixed(2)} ms`);
    expect(median).toBeLessThanOrEqual(10);
  });
});
