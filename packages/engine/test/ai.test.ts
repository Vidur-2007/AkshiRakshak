/**
 * AI second opinion, engine side, against a mocked /api/ai/analyze (no network).
 */
import {
  AnalysisResultSchema,
  type AiAnalyzeRequest,
  type AiAnalyzeResponse,
} from '@akshi/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { findQuote } from '../src/ai';
import { analyze, setApiBase } from '../src/index';

const TEXT =
  'Hello, I am Inspector Rao. Your Aadhaar is linked to a parcel with drugs. Call 98765 00001 and stay on the video call.';
const OFFLINE_EXTRAS = {
  expandLinks: false,
  domainAge: false,
  layers: { indicators: false },
} as const;

let sent: AiAnalyzeRequest | null = null;
function mockAi(reply: Partial<AiAnalyzeResponse> | null, status = 200) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init?: RequestInit) => {
      sent = JSON.parse(String(init?.body)) as AiAnalyzeRequest;
      if (!reply)
        return new Response(
          JSON.stringify({ error: { code: 'upstream_unavailable', message: 'x' } }),
          { status: 503 },
        );
      const body: AiAnalyzeResponse = {
        provider: 'groq',
        model: 'test-model',
        category: 'digital_arrest',
        likelihood: 95,
        explanation:
          'This is a digital arrest scam. Police never question people over video calls.',
        redFlags: [],
        advice: 'End the call.',
        ...reply,
      };
      return new Response(JSON.stringify(body), { status });
    }),
  );
}

beforeEach(() => {
  sent = null;
  setApiBase('http://api.test');
});
afterEach(() => {
  vi.unstubAllGlobals();
  setApiBase('');
});

describe('findQuote', () => {
  it('finds quotes directly or through mask tags', () => {
    expect(findQuote(TEXT, 'stay on the video call')).toMatchObject({
      text: 'stay on the video call',
    });
    const s = findQuote(TEXT, 'Call [PHONE] and stay');
    expect(s?.text).toBe('Call 98765 00001 and stay');
    expect(findQuote(TEXT, 'not in the text')).toBeNull();
  });
});

describe('analyze() with cloudAI', () => {
  it('sends only masked text, blends the AI score (max +15) and maps red flags to spans', async () => {
    mockAi({
      redFlags: [
        { quote: 'stay on the video call', reason: 'Keeps you on a call' },
        { quote: 'Call [PHONE]', reason: 'Unknown number' },
        { quote: 'invented quote', reason: 'x' },
      ],
    });
    const without = await analyze({
      kind: 'message',
      text: TEXT,
      lang: 'en',
      options: OFFLINE_EXTRAS,
    });
    const r = AnalysisResultSchema.parse(
      await analyze({
        kind: 'message',
        text: TEXT,
        lang: 'en',
        options: { ...OFFLINE_EXTRAS, cloudAI: true },
      }),
    );

    expect(sent?.maskedText).toContain('[PHONE]');
    expect(sent?.maskedText).not.toContain('98765');
    expect(sent?.localScore).toBe(without.riskScore);
    expect(sent?.ruleSignals).toEqual(expect.arrayContaining(['THREAT_LEGAL', 'STAY_ON_CALL']));

    expect(r.aiUsed).toBe(true);
    expect(r.aiProvider).toBe('groq');
    expect(r.offline).toBe(false);
    expect(r.stages.find((s) => s.stage === 'ai')?.status).toBe('done');
    expect(r.riskScore).toBeGreaterThanOrEqual(without.riskScore);
    expect(r.riskScore).toBeLessThanOrEqual(Math.min(100, without.riskScore + 15));
    expect(r.layers.find((l) => l.layer === 'ai')).toMatchObject({ available: true, score: 95 });

    const flags = r.signals.filter((s) => s.id === 'AI_FLAG');
    expect(flags).toHaveLength(2); // the invented quote was dropped
    expect(flags.every((f) => f.source === 'ai')).toBe(true);
    expect(flags.map((f) => f.spans[0]?.text).sort()).toEqual([
      'Call 98765 00001',
      'stay on the video call',
    ]);
    for (const s of flags.flatMap((f) => f.spans))
      expect(r.text.slice(s.start, s.end)).toBe(s.text);
    expect(r.explanation).toBe(
      'This is a digital arrest scam. Police never question people over video calls.',
    );
    expect(r.category).toBe('digital_arrest');
  });

  it('cannot lift a weak local score by more than 15 points', async () => {
    const text = 'See you at the station at 5';
    const local = await analyze({ kind: 'message', text, lang: 'en', options: OFFLINE_EXTRAS });
    mockAi({ likelihood: 100, category: 'other' });
    const r = await analyze({
      kind: 'message',
      text,
      lang: 'en',
      options: { ...OFFLINE_EXTRAS, cloudAI: true },
    });
    expect(r.riskScore).toBeLessThanOrEqual(local.riskScore + 15);
    expect(r.verdict).not.toBe('scam');
  });

  it('ignores an AI category that agrees with neither rules nor model', async () => {
    mockAi({ category: 'romance' });
    const r = await analyze({
      kind: 'message',
      text: TEXT,
      lang: 'en',
      options: { ...OFFLINE_EXTRAS, cloudAI: true },
    });
    expect(r.category).toBe('digital_arrest');
  });

  it('falls back silently when the API fails or returns junk', async () => {
    mockAi(null, 503);
    const r = await analyze({
      kind: 'message',
      text: TEXT,
      lang: 'en',
      options: { ...OFFLINE_EXTRAS, cloudAI: true },
    });
    expect(r.aiUsed).toBe(false);
    expect(r.stages.find((s) => s.stage === 'ai')?.status).toBe('failed');
    expect(r.signals.some((s) => s.id === 'AI_FLAG')).toBe(false);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{"provider":"groq","likelihood":"high"}')),
    );
    expect(
      (
        await analyze({
          kind: 'message',
          text: TEXT,
          lang: 'en',
          options: { ...OFFLINE_EXTRAS, cloudAI: true },
        })
      ).aiUsed,
    ).toBe(false);
  });

  it('never calls the API when cloudAI is off, the AI layer is off, or the device is offline', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    await analyze({ kind: 'message', text: TEXT, lang: 'en', options: OFFLINE_EXTRAS });
    await analyze({
      kind: 'message',
      text: TEXT,
      lang: 'en',
      options: { ...OFFLINE_EXTRAS, cloudAI: true, layers: { ai: false } },
    });
    vi.stubGlobal('navigator', { onLine: false });
    const r = await analyze({
      kind: 'message',
      text: TEXT,
      lang: 'en',
      options: { ...OFFLINE_EXTRAS, cloudAI: true },
    });
    expect(fetch).not.toHaveBeenCalled();
    expect(r.stages.find((s) => s.stage === 'ai')?.status).toBe('skipped');
  });
});
