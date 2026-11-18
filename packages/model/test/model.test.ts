import { describe, expect, it } from 'vitest';
import { CalibrationSchema, ModelPredictionSchema, SCAM_CATEGORIES, normalizeText } from '@akshi/contracts';
import { DEFAULT_CALIBRATION, parseCalibration } from '../src/calibration';
import { MODEL_VERSION, loadCalibration, loadModel } from '../src/index';
import { createModel, parseModelJson } from '../src/model';
import versionJson from '../model/version.json';
import calibrationJson from '../model/calibration.json';

const KYC = normalizeText(
  'Dear Customer, your SBI account will be BLOCKED today due to pending KYC. Update KYC immediately at http://sbi-kyc-update.xyz/verify or call 98765 00001.',
);
const OTP = normalizeText(
  '482913 is your OTP for a transaction of Rs 2,499.00 on your HDFC Bank card ending XX0000. Do not share your OTP with anyone.',
);

const tiny = () => ({
  format: 'akshi-lr-v1',
  version: 'test',
  trainedAt: '2026-11-16T00:00:00Z',
  features: ['w:otp', 'w:share', 'w:hello'],
  idf: [1, 2, 1],
  scam: { coef: [1, 2, -3], intercept: -0.5 },
  category: { classes: ['otp_theft', 'fake_kyc'], coef: [[[0, 2]], [[1, 0.5]]], intercept: [0, 0.1] },
});

describe('loadModel', () => {
  it('loads the exported model once and reports its version', async () => {
    const model = await loadModel();
    expect(model).not.toBeNull();
    expect(model!.version).toBe(MODEL_VERSION);
    expect(MODEL_VERSION).toMatch(/^\d{4}\.\d{2}\.\d{2}-[a-z]$/);
    expect(versionJson.version).toBe(MODEL_VERSION);
    expect(await loadModel()).toBe(model);
  });

  it('exported model is within the size budget', () => {
    expect(versionJson.rawBytes).toBeLessThanOrEqual(1_200_000);
    expect(versionJson.features).toBeLessThanOrEqual(20_000);
  });
});

describe('createModel rejects anything that is not an akshi-lr-v1 model', () => {
  it.each([
    ['null', null],
    ['a string', 'model'],
    ['unknown format', { ...tiny(), format: 'akshi-lr-v2' }],
    ['no version', { ...tiny(), version: undefined }],
    ['empty features', { ...tiny(), features: [] }],
    ['idf of the wrong length', { ...tiny(), idf: [1, 2] }],
    ['coef of the wrong length', { ...tiny(), scam: { coef: [1], intercept: 0 } }],
    ['non-numeric coef', { ...tiny(), scam: { coef: [1, 'x', 2], intercept: 0 } }],
    ['category index out of range', { ...tiny(), category: { ...tiny().category, coef: [[[9, 1]], []] } }],
    ['intercepts not matching classes', { ...tiny(), category: { ...tiny().category, intercept: [0] } }],
    ['missing category', { ...tiny(), category: undefined }],
  ])('%s → null', (_name, raw) => {
    expect(parseModelJson(raw)).toBeNull();
    expect(createModel(raw)).toBeNull();
  });
});

describe('predict', () => {
  it('computes tf-idf, the L2 norm, sigmoid and softmax as specified (hand-checked)', () => {
    const model = createModel(tiny())!;
    // "otp otp share": counts otp 2, share 1 → tf 1+ln2, 1 → x = [(1+ln2)*1, 1*2] / norm
    const a = 1 + Math.log(2);
    const norm = Math.hypot(a, 2);
    const z = -0.5 + (a / norm) * 1 + (2 / norm) * 2;
    const p = model.predict('otp otp share');
    expect(p.pScam).toBeCloseTo(1 / (1 + Math.exp(-z)), 12);
    const l0 = (a / norm) * 2;
    const l1 = 0.1 + (2 / norm) * 0.5;
    expect(p.categoryProbs.otp_theft).toBeCloseTo(Math.exp(l0) / (Math.exp(l0) + Math.exp(l1)), 12);
    expect(p.category).toBe('otp_theft');
    expect(p.contributions.map((c) => c.feature)).toEqual(['w:share', 'w:otp']);
    expect(p.contributions[1]!.spans).toEqual([
      { start: 0, end: 3, text: 'otp' },
      { start: 4, end: 7, text: 'otp' },
    ]);
  });

  it('returns no category below 0.4 and no negative contributions', () => {
    const p = createModel(tiny())!.predict('hello');
    expect(p.pScam).toBeLessThan(0.4);
    expect(p.category).toBeNull();
    expect(p.contributions).toEqual([]);
  });

  it('handles empty text and text with no known feature', () => {
    const model = createModel(tiny())!;
    for (const text of ['', 'zzz qqq']) {
      const p = model.predict(text);
      expect(p.pScam).toBeCloseTo(1 / (1 + Math.exp(0.5)), 12);
      expect(p.contributions).toEqual([]);
    }
  });

  it('real model: output fits the contract, contributions are the top 25 positive with valid spans', async () => {
    const model = (await loadModel())!;
    for (const text of [KYC, OTP, '', 'ok', 'आपका खाता बंद हो जाएगा, तुरंत KYC करें', '🎁🎁🎁']) {
      const p = model.predict(text);
      ModelPredictionSchema.parse(p);
      expect(p.contributions.length).toBeLessThanOrEqual(25);
      expect(Object.keys(p.categoryProbs).length).toBeLessThanOrEqual(5);
      Object.keys(p.categoryProbs).forEach((c) => expect(SCAM_CATEGORIES).toContain(c));
      p.contributions.forEach((c, i) => {
        expect(c.value).toBeGreaterThan(0);
        if (i > 0) expect(c.value).toBeLessThanOrEqual(p.contributions[i - 1]!.value);
        expect(c.spans.length).toBeGreaterThan(0);
        c.spans.forEach((s, k) => {
          expect(text.slice(s.start, s.end)).toBe(s.text);
          if (k > 0) expect(s.start).toBeGreaterThanOrEqual(c.spans[k - 1]!.end); // merged, in order
        });
      });
    }
  });

  it('real model: a KYC-block scam scores far above a genuine bank OTP', async () => {
    const model = (await loadModel())!;
    const scam = model.predict(KYC);
    const genuine = model.predict(OTP);
    expect(scam.pScam).toBeGreaterThan(0.8);
    expect(genuine.pScam).toBeLessThan(0.3);
    expect(scam.category).not.toBeNull();
    expect(genuine.category).toBeNull();
  });
});

describe('calibration', () => {
  it('loads calibration.json, valid against the contract and the engine\'s check, as a fresh object each time', () => {
    const c = loadCalibration();
    CalibrationSchema.parse(c);
    // the file itself is loaded, not the fallback
    expect(c).toEqual(calibrationJson);
    expect(c.version).toBe(MODEL_VERSION);
    // the engine silently falls back to the defaults unless all of these hold (packages/engine/src/pipeline/calibration.ts)
    const { scam, suspicious } = c.thresholds;
    expect(0 < suspicious && suspicious < scam && scam < 100).toBe(true);
    for (const w of Object.values(c.fusion)) expect(w >= 0 && w <= 1).toBe(true);
    expect(c.fusion.rules).toBeGreaterThan(0);
    expect(c.aiBlend >= 0 && c.aiBlend <= 1).toBe(true);
    const before = c.thresholds.scam;
    c.thresholds.scam = 1;
    expect(loadCalibration().thresholds.scam).toBe(before);
  });

  it('falls back to the defaults as a whole when the file is missing or invalid', () => {
    const d = { ...DEFAULT_CALIBRATION };
    const good = { version: 'x', thresholds: { scam: 75, suspicious: 35 }, fusion: { rules: 0.5, model: 0.3, links: 0.2 }, aiBlend: 0.1 };
    expect(parseCalibration(good)).toEqual(good);
    for (const bad of [
      undefined,
      null,
      {},
      { ...good, thresholds: { scam: 30, suspicious: 40 } },
      { ...good, thresholds: { scam: 170, suspicious: 40 } },
      { ...good, fusion: { rules: 0.5, model: 2, links: 0.2 } },
      { ...good, fusion: { rules: 0.5, model: 0.3 } },
      { ...good, aiBlend: 'x' },
      { ...good, version: 7 },
    ]) {
      expect(parseCalibration(bad)).toEqual(d);
    }
    expect(parseCalibration(null)).not.toBe(DEFAULT_CALIBRATION);
  });
});
