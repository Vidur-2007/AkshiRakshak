import { describe, expect, it } from 'vitest';
import { normalizeText } from '@akshi/contracts';
import type { ScamCategory } from '@akshi/contracts';
import { MODEL_VERSION, loadModel } from '../src/index';
import parity from './parity-fixtures.json';

describe('parity with scikit-learn (SPEC_C_DATA.md §4.5)', () => {
  it('fixtures were written for the exported model', () => {
    expect(parity.modelVersion).toBe(MODEL_VERSION);
    expect(parity.cases).toHaveLength(200);
    expect(new Set(parity.cases.map((c) => c.lang))).toEqual(new Set(['en', 'hi', 'te', 'bn']));
    expect(parity.cases.some((c) => c.lang === 'hi' && c.script === 'latn')).toBe(true);
    expect(parity.cases.some((c) => /\p{Extended_Pictographic}/u.test(c.text))).toBe(true);
  });

  it('normalises every text exactly as Python does', () => {
    for (const c of parity.cases) expect(normalizeText(c.text), c.id).toBe(c.normalized);
  });

  it('gives the same scam probability (|Δ| < 1e-3) and the same category argmax for all 200 texts', async () => {
    const model = await loadModel();
    expect(model).not.toBeNull();
    let worst = 0;
    for (const c of parity.cases) {
      const p = model!.predict(normalizeText(c.text));
      const delta = Math.abs(p.pScam - c.pScam);
      worst = Math.max(worst, delta);
      expect(delta, `${c.id} pScam ${p.pScam} vs ${c.pScam}`).toBeLessThan(1e-3);
      const [top] = Object.entries(p.categoryProbs).sort((a, b) => b[1] - a[1]);
      expect(top?.[0], c.id).toBe(c.category);
      if (p.pScam >= 0.4) expect(p.category, c.id).toBe(c.category as ScamCategory);
      else expect(p.category, c.id).toBeNull();
    }
    expect(worst).toBeLessThan(1e-3);
  });
});
