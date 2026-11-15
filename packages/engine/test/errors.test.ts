/**
 * Error states (SPEC_A_ENGINE.md §15, P6): every API failure — network error, timeout, offline,
 * rate limit, server error, bad JSON, wrong shape — degrades to the local result. The scan never
 * throws, the AI layer is marked unavailable, the score and explanation equal a fully offline
 * scan, and no raw error reaches UI text. The other network helpers fall back the same way.
 */
import { AnalysisResultSchema, type AnalysisResult } from '@akshi/contracts';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  analyze,
  apiHealth,
  askAssistant,
  communityReports,
  inspectUrl,
  reportToCommunity,
  warmup,
} from '../src/index';
import { netSchemas } from '../src/schemas-lazy';

const MSG =
  'Dear customer, your SBI account will be blocked today. Update KYC at http://sbi-kyc-update.xyz/verify and share the OTP.';
const LOCAL = { cloudAI: false, expandLinks: false, domainAge: false } as const;
const NETWORK = { cloudAI: true, expandLinks: true, domainAge: true } as const;

const MODES = [
  'network-error',
  'http-429',
  'http-500',
  'http-503',
  'bad-json',
  'wrong-shape',
  'timeout',
  'offline',
] as const;
type Mode = (typeof MODES)[number];

function fakeFetch(mode: Mode) {
  return vi.fn(async (_url: string, init?: RequestInit): Promise<Response> => {
    switch (mode) {
      case 'network-error':
        throw new TypeError('Failed to fetch');
      case 'http-429':
        return new Response(
          JSON.stringify({ error: { code: 'rate_limited', message: 'Too many requests' } }),
          { status: 429, headers: { 'retry-after': '60' } },
        );
      case 'http-500':
        return new Response('Internal Server Error', { status: 500 });
      case 'http-503':
        return new Response(
          JSON.stringify({ error: { code: 'upstream_unavailable', message: 'down' } }),
          { status: 503 },
        );
      case 'bad-json':
        return new Response('<html>not json', { status: 200 });
      case 'wrong-shape':
        return new Response(JSON.stringify({ likelihood: 'very', hops: 'many', reports: -1 }), {
          status: 200,
        });
      case 'timeout':
      case 'offline':
        // never answers; only the caller's abort ends it
        return new Promise<Response>((_, reject) =>
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          ),
        );
    }
  });
}

const RAW_ERROR =
  /\b(?:TypeError|DOMException|AbortError|Error:|Exception|undefined|NaN|null|429|500|503|rate_limited|upstream_unavailable|Failed to fetch)\b|\[object \w+\]/;
const uiText = (r: AnalysisResult) => [
  r.explanation,
  ...r.signals.flatMap((s) => [s.label, s.detail]),
  ...r.claimVsReality.flatMap((c) => [c.claim, c.reality]),
];

let base: AnalysisResult;
beforeAll(async () => {
  // load lazy chunks with real timers so the fake-timer runs below only wait on the network
  await Promise.all([warmup(), netSchemas()]);
  base = await analyze({ kind: 'message', text: MSG, lang: 'en', options: LOCAL });
  expect(base.verdict).toBe('scam');
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** Runs fn with a failing network; for hanging modes, fast-forwards past every deadline. */
async function withFailure<T>(
  mode: Mode,
  fn: () => Promise<T>,
): Promise<{ out: T; calls: number }> {
  const f = fakeFetch(mode);
  vi.stubGlobal('fetch', f);
  if (mode === 'offline') vi.stubGlobal('navigator', { onLine: false });
  if (mode === 'timeout' || mode === 'offline') {
    vi.useFakeTimers();
    const p = fn();
    await vi.advanceTimersByTimeAsync(60_000);
    return { out: await p, calls: f.mock.calls.length };
  }
  return { out: await fn(), calls: f.mock.calls.length };
}

describe.each(MODES)('API failure: %s', (mode) => {
  it('analyze() falls back to the local result', async () => {
    const { out: r, calls } = await withFailure(mode, () =>
      analyze({ kind: 'message', text: MSG, lang: 'en', options: NETWORK }),
    );
    expect(AnalysisResultSchema.safeParse(r).success).toBe(true);
    if (mode === 'offline') expect(calls).toBe(0);
    else expect(calls).toBeGreaterThan(0);

    expect(r.aiUsed).toBe(false);
    expect(r.offline).toBe(true);
    const ai = r.layers.find((l) => l.layer === 'ai')!;
    expect(ai.available).toBe(false);
    expect(ai.share).toBe(0);
    // links layer still works locally; network extras are absent, not errors
    expect(r.layers.find((l) => l.layer === 'links')?.available).toBe(true);
    const url = r.entities.urls[0]!;
    expect(url.expanded).toBeUndefined();
    expect(url.domainAge).toBeUndefined();
    expect(r.signals.some((s) => s.id === 'AI_FLAG')).toBe(false);

    expect(r.riskScore).toBe(base.riskScore);
    expect(r.verdict).toBe(base.verdict);
    expect(r.category).toBe(base.category);
    expect(r.explanation).toBe(base.explanation);
    for (const s of uiText(r)) expect(RAW_ERROR.test(s), s).toBe(false);
    expect(r.stages.find((s) => s.stage === 'ai')?.status).toMatch(/failed|skipped/);
  });

  it('the other network helpers fall back quietly', async () => {
    const { out } = await withFailure(mode, async () => ({
      ask: await askAssistant('Do I need my PIN to receive money?', 'en', { online: true }),
      offlineAsk: await askAssistant('Do I need my PIN to receive money?', 'en'),
      reports: await communityReports('upi', 'fake.refund@ybl'),
      posted: await reportToCommunity('upi', 'fake.refund@ybl', 'refund_cashback'),
      health: await apiHealth(),
      url: await inspectUrl('http://sbi-kyc-update.xyz/verify'),
      localUrl: await inspectUrl('http://sbi-kyc-update.xyz/verify', {
        expand: false,
        domainAge: false,
      }),
    }));
    expect(out.ask.mode).toBe('offline');
    expect(out.ask.answer).toBe(out.offlineAsk.answer);
    expect(out.ask.answer).not.toMatch(RAW_ERROR);
    expect(out.reports).toBeNull();
    expect(out.posted).toBeNull();
    expect(out.health).toEqual({ online: false, ai: false });
    expect(out.url).toEqual(out.localUrl);
  });
});

describe('cancelled scan', () => {
  it('an aborted signal rejects with AbortError (the UI treats it as cancel, not as a failure)', async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    await expect(
      analyze({
        kind: 'message',
        text: MSG,
        lang: 'en',
        options: { ...LOCAL, signal: ctrl.signal },
      }),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });
});
