/**
 * Model stage with a fake TextModel (C's @akshi/model is a stub that returns null on this branch).
 */
import type { ModelPrediction, TextModel } from '@akshi/contracts';
import type * as ModelModule from '@akshi/model';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const loadModel = vi.fn<() => Promise<TextModel | null>>();
vi.mock('@akshi/model', async (orig) => ({
  ...(await orig<typeof ModelModule>()),
  loadModel: () => loadModel(),
}));

const { analyze, warmup } = await import('../src/index');
const { getModel, modelSignal, resetModelCache, safePredict } = await import('../src/model');
const { currentCalibration } = await import('../src/pipeline/calibration');

const OFF = { expandLinks: false, domainAge: false, layers: { indicators: false } } as const;

/** Predicts from simple keyword hits, with contributions spanning each hit (like C's model). */
function fakeModel(
  pScam: number,
  category: ModelPrediction['category'] = 'fake_kyc',
  prob = 0.8,
): TextModel {
  return {
    version: 'fake-1',
    predict: (text) => {
      const contributions = ['kyc', 'block', 'upd'].flatMap((w, i) => {
        const at = text.toLowerCase().indexOf(w);
        return at >= 0
          ? [
              {
                feature: `c:${w}`,
                value: 1 - i * 0.2,
                spans: [{ start: at, end: at + w.length, text: text.slice(at, at + w.length) }],
              },
            ]
          : [];
      });
      return {
        pScam,
        category,
        categoryProbs: category ? { [category]: prob } : {},
        contributions,
      };
    },
  };
}

beforeEach(() => {
  resetModelCache();
  loadModel.mockReset();
});
afterEach(() => resetModelCache());

describe('getModel', () => {
  it('memoises loadModel()', async () => {
    loadModel.mockResolvedValue(fakeModel(0.9));
    await Promise.all([getModel(), getModel(), warmup()]);
    expect(loadModel).toHaveBeenCalledTimes(1);
  });

  it('treats a throwing loader as no model', async () => {
    loadModel.mockRejectedValue(new Error('chunk failed'));
    expect(await getModel()).toBeNull();
  });
});

describe('MODEL_PATTERN mapping (§7)', () => {
  it('merges spans within one character, expands to word boundaries and keeps ≤ 6 phrases', () => {
    const text = 'Update KYC now or your account gets blocked';
    const pred: ModelPrediction = {
      pScam: 0.9,
      category: 'fake_kyc',
      categoryProbs: { fake_kyc: 0.9 },
      contributions: [
        { feature: 'c:upd', value: 0.5, spans: [{ start: 0, end: 3, text: 'Upd' }] },
        { feature: 'c:ate k', value: 0.4, spans: [{ start: 3, end: 8, text: 'ate K' }] },
        { feature: 'w:blocked', value: 0.9, spans: [{ start: 36, end: 43, text: 'blocked' }] },
        { feature: 'w:neg', value: -0.5, spans: [{ start: 11, end: 14, text: 'now' }] },
      ],
    };
    const s = modelSignal(text, pred, 'en')!;
    expect(s).toMatchObject({
      id: 'MODEL_PATTERN',
      source: 'model',
      label: 'Wording seen in scams',
    });
    expect(s.spans.map((x) => x.text)).toEqual(['Update KYC', 'blocked']);
    for (const sp of s.spans) expect(text.slice(sp.start, sp.end)).toBe(sp.text);
    const many = {
      ...pred,
      contributions: Array.from({ length: 10 }, (_, i) => ({
        feature: `f${i}`,
        value: 1,
        spans: [{ start: i * 4, end: i * 4 + 2, text: text.slice(i * 4, i * 4 + 2) }],
      })),
    };
    expect(modelSignal(text, many, 'en')!.spans.length).toBeLessThanOrEqual(6);
  });

  it('returns no signal without positive contributions, and safePredict never throws', () => {
    expect(
      modelSignal('x', { pScam: 0.2, category: null, categoryProbs: {}, contributions: [] }, 'en'),
    ).toBeNull();
    expect(
      safePredict(
        {
          version: 'x',
          predict: () => {
            throw new Error('bad');
          },
        },
        'x',
      ),
    ).toBeNull();
    expect(
      safePredict(
        {
          version: 'x',
          predict: () => ({ pScam: 1.7, category: null, categoryProbs: {}, contributions: [] }),
        },
        'x',
      )?.pScam,
    ).toBe(1);
  });
});

describe('analyze() with a model', () => {
  it('marks the model layer unavailable and skips the stage when no model loads', async () => {
    loadModel.mockResolvedValue(null);
    const r = await analyze({
      kind: 'message',
      text: 'Update KYC or your account is blocked',
      lang: 'en',
      options: OFF,
    });
    expect(r.layers.find((l) => l.layer === 'model')).toMatchObject({ available: false, score: 0 });
    expect(r.stages.find((s) => s.stage === 'model')?.status).toBe('skipped');
  });

  it('blends the model score per §8.2 and adds MODEL_PATTERN', async () => {
    loadModel.mockResolvedValue(fakeModel(0.95));
    const r = await analyze({
      kind: 'message',
      text: 'Update KYC or your account is blocked',
      lang: 'en',
      options: OFF,
    });
    const layer = r.layers.find((l) => l.layer === 'model')!;
    expect(layer).toMatchObject({ available: true, score: 95 });
    expect(layer.share).toBeGreaterThan(0);
    expect(r.signals.map((s) => s.id)).toContain('MODEL_PATTERN');
    expect(r.stages.find((s) => s.stage === 'model')?.status).toBe('done');
    const rules = r.layers.find((l) => l.layer === 'rules')!.score;
    // weights from the calibration the engine uses (C's calibration.json, or the defaults)
    const { rules: wr, model: wm } = currentCalibration().fusion;
    expect(r.riskScore).toBe(Math.round((wr * rules + wm * 95) / (wr + wm)));
  });

  it('keeps the rules category over the model, and uses the model when no rule names one (§8.4)', async () => {
    loadModel.mockResolvedValue(fakeModel(0.9, 'job_task', 0.7));
    const kyc = await analyze({
      kind: 'message',
      text: 'Update KYC or your account is blocked',
      lang: 'en',
      options: OFF,
    });
    expect(kyc.category).toBe('fake_kyc');
    const vague = await analyze({
      kind: 'message',
      text: 'Reply urgently today, it is very important',
      lang: 'en',
      options: OFF,
    });
    expect(vague.verdict).not.toBe('no_signs');
    expect(vague.category).toBe('job_task');
  });

  it('does not run the model on a bare URL, UPI ID, phone number or QR payload', async () => {
    const predict = vi.fn(() => ({
      pScam: 0.99,
      category: null,
      categoryProbs: {},
      contributions: [],
    }));
    loadModel.mockResolvedValue({ version: 'spy', predict });
    for (const req of [
      { kind: 'url' as const, url: 'https://example.org' },
      { kind: 'upi_id' as const, upiId: 'someone@okaxis' },
      { kind: 'phone' as const, phone: '+91 98765 00001' },
      { kind: 'qr' as const, qrPayload: 'upi://pay?pa=shop@okaxis&pn=Shop' },
    ]) {
      const r = await analyze({ ...req, lang: 'en', options: OFF });
      expect(r.layers.find((l) => l.layer === 'model')?.available, req.kind).toBe(false);
      expect(r.stages.find((s) => s.stage === 'model')?.status).toBe('skipped');
    }
    expect(predict).not.toHaveBeenCalled();
    await analyze({ kind: 'message', text: 'hello there', lang: 'en', options: OFF });
    expect(predict).toHaveBeenCalledTimes(1);
  });

  it('lowers the score when the model disagrees with weak rules', async () => {
    loadModel.mockResolvedValue(fakeModel(0.02, null, 0));
    const r = await analyze({
      kind: 'message',
      text: 'Your account will be blocked',
      lang: 'en',
      options: OFF,
    });
    expect(r.verdict).toBe('no_signs');
  });

  it('switches the model off with layers.model = false', async () => {
    loadModel.mockResolvedValue(fakeModel(0.95));
    const r = await analyze({
      kind: 'message',
      text: 'Update KYC',
      lang: 'en',
      options: { ...OFF, layers: { model: false, indicators: false } },
    });
    expect(r.layers.find((l) => l.layer === 'model')?.available).toBe(false);
  });
});
