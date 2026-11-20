/**
 * Security review checks (P6): truth guard on model text, rate limits on every endpoint that
 * spends a quota, no CORS headers (same origin only), and no user text, URL, value or IP in logs
 * even with logging switched on.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanOutput, type AiProvider } from '../_lib/ai.js';
import { resetRateLimits } from '../_lib/ratelimit.js';
import { claimsSafe, unsupportedClaim } from '../_lib/truth.js';
import { POST as aiAnalyze, __setProviders as setAiProviders } from '../ai/analyze.js';
import { POST as aiVision, __setVisionProvider } from '../ai/vision.js';
import { POST as ask, __setProviders as setAskProviders } from '../ask.js';
import { GET as domainAge } from '../domain-age.js';
import { GET as expand } from '../expand.js';
import { GET as health } from '../health.js';
import { GET as getReports, POST as postReport, __setRedisFetch } from '../reports.js';

const MARK = 'zqxmarker'; // appears in every user-supplied value below
const IP = '203.0.113.77';
const req = (url: string, body?: unknown) =>
  new Request(`http://localhost${url}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'x-forwarded-for': IP, 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
const provider = (name: 'groq' | 'gemini', out: unknown): AiProvider => ({
  name,
  model: `${name}-m`,
  generate: vi.fn(async () => out),
});
const AI_BODY = {
  maskedText: `Your account will be blocked, share the OTP ${MARK} now`,
  kind: 'message',
  lang: 'en',
  ruleSignals: ['THREAT_BLOCK', 'ASKS_OTP'],
  localCategory: 'fake_kyc',
  localScore: 70,
};
const GOOD = {
  category: 'fake_kyc',
  likelihood: 92,
  explanation: 'It threatens to block the account and asks for the OTP, which banks never do.',
  redFlags: [{ quote: 'share the OTP', reason: 'Banks never ask for an OTP.' }],
  advice: 'Do not share the OTP. Call your bank on the number on your card.',
};
const PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const fakeUpstash = vi.fn(async (_u: string, init: RequestInit) => {
  const cmds = JSON.parse(String(init.body)) as unknown[][];
  return new Response(
    JSON.stringify(cmds.map(() => ({ result: cmds[0]?.[0] === 'HGETALL' ? [] : 1 }))),
  );
});

beforeEach(() => resetRateLimits());
afterEach(() => {
  setAiProviders(null);
  setAskProviders(null);
  __setVisionProvider(undefined);
  __setRedisFetch(null);
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('truth guard (§1.3) on model text', () => {
  it('recognises "safe" claims in four languages, not warnings', () => {
    for (const t of [
      'This message is safe.',
      'The link looks safe to open.',
      'This is not a scam.',
      'It appears genuine.',
      'Nothing to worry about.',
      'यह संदेश सुरक्षित है',
      'ఈ సందేశం సురక్షితం',
      'এই বার্তাটি নিরাপদ',
    ])
      expect(claimsSafe(t), t).toBe(true);
    for (const t of [
      'This pretends to be your bank and asks for the OTP.',
      'An unsafe link that copies a bank name.',
      'Never share your PIN; it is only for sending money.',
      'For your safety, call 1930 if money left your account.',
    ])
      expect(claimsSafe(t), t).toBe(false);
  });

  it('blanks an AI explanation or advice that calls the message safe; keeps the score', () => {
    const out = cleanOutput(
      {
        ...GOOD,
        likelihood: 12,
        explanation: 'This looks like a genuine bank alert and is safe.',
        advice: 'The link is safe.',
        redFlags: [
          { quote: 'share the OTP', reason: 'Banks never ask for an OTP.' },
          { quote: 'account will be blocked', reason: 'This part is safe.' },
        ],
      },
      AI_BODY.maskedText,
    )!;
    expect(out.likelihood).toBe(12);
    expect(out.explanation).toBe('');
    expect(out.advice).toBe('');
    expect(out.redFlags.map((f) => f.quote)).toEqual(['share the OTP']);
    expect(cleanOutput(GOOD, AI_BODY.maskedText)!.explanation).toBe(GOOD.explanation);
  });

  it('/api/ai/analyze never returns a "safe" explanation', async () => {
    setAiProviders([provider('groq', { ...GOOD, explanation: 'This is not a scam, it is safe.' })]);
    const res = await aiAnalyze(req('/api/ai/analyze', AI_BODY));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { explanation: string; likelihood: number };
    expect(body.explanation).toBe('');
    expect(body.likelihood).toBe(92);
  });

  it('/api/ask never returns an answer that calls something safe', async () => {
    setAskProviders([
      provider('groq', { answer: 'Yes, that QR is safe to scan.', covered: true }),
      provider('gemini', { answer: 'यह पूरी तरह सुरक्षित है।', covered: true }),
    ]);
    const res = await ask(
      req('/api/ask', { question: 'Is this QR ok?', lang: 'en', faqIds: ['faq-qr-receive'] }),
    );
    expect(res.status).toBe(503); // the engine then shows the offline FAQ answer
  });
});

describe('evidence guard on model text (no unsupported facts)', () => {
  const MSG = 'Pay Rs 5,000 to clear the case at officer.desk@okaxis or call 98765 43210 today';

  it('flags report counts, "verified" claims and values the message does not contain', () => {
    for (const t of [
      'This UPI ID has been reported by 120 users.',
      'The number is blacklisted.',
      'This is a known scammer.',
      'We have verified this is a fraud account.',
      'The bank confirmed it is fake.',
      'Send nothing to refund.help@ybl, it belongs to the scammer.',
      'Call 91234 56789 to report.',
      'They will ask you to open sbi-secure-login.xyz.',
    ])
      expect(unsupportedClaim(t, MSG), t).toBe(true);
  });

  it('allows values from the message, official sites, 1930, dates and amounts', () => {
    for (const t of [
      'It asks you to pay officer.desk@okaxis, a personal UPI ID.',
      'It gives the mobile number 98765 43210.',
      'Call 1930 or report at cybercrime.gov.in, or write to help@cybercrime.gov.in.',
      'Report the number on sancharsaathi.gov.in.',
      'It demands Rs 5,000 by 12-11-2026 10:30.',
      'Police never collect fines over a call.',
    ])
      expect(unsupportedClaim(t, MSG), t).toBe(false);
  });

  it('allows a report claim only when our own lookup found the value', () => {
    expect(unsupportedClaim('This number was reported in scam messages.', MSG, true)).toBe(false);
    expect(unsupportedClaim('This number was reported in scam messages.', MSG, false)).toBe(true);
  });

  it('drops unsupported AI red flags and blanks unsupported explanation and advice; keeps the score', () => {
    const out = cleanOutput(
      {
        ...GOOD,
        explanation: 'This exact message was reported by 300 people last week.',
        advice: 'Call the bank fraud line at 91234 56789.',
        redFlags: [
          { quote: 'share the OTP', reason: 'Banks never ask for an OTP.' },
          { quote: 'account will be blocked', reason: 'This sender is blacklisted.' },
        ],
      },
      AI_BODY.maskedText,
      AI_BODY.ruleSignals,
    )!;
    expect(out.likelihood).toBe(92);
    expect(out.explanation).toBe('');
    expect(out.advice).toBe('');
    expect(out.redFlags.map((f) => f.quote)).toEqual(['share the OTP']);
    const withLookup = cleanOutput(
      { ...GOOD, explanation: 'This number was reported in earlier scam messages.' },
      AI_BODY.maskedText,
      [...AI_BODY.ruleSignals, 'KNOWN_INDICATOR'],
    )!;
    expect(withLookup.explanation).toContain('reported');
  });

  it('/api/ask never returns an invented helpline number or website', async () => {
    setAskProviders([
      provider('groq', { answer: 'Call the RBI helpline at 91234 56789 now.', covered: true }),
      provider('gemini', { answer: 'Report it at rbi-complaints-help.com today.', covered: true }),
    ]);
    const res = await ask(
      req('/api/ask', { question: 'Who do I call?', lang: 'en', faqIds: ['faq-qr-receive'] }),
    );
    expect(res.status).toBe(503); // the engine then shows the offline FAQ answer
  });
});

describe('rate limits', () => {
  it('limits /api/reports reads and writes per minute (Upstash quota)', async () => {
    vi.stubEnv('KV_REST_API_URL', 'https://redis.test');
    vi.stubEnv('KV_REST_API_TOKEN', 'token');
    __setRedisFetch(fakeUpstash);
    let last = 0;
    for (let i = 0; i < 61; i++)
      last = (await getReports(req('/api/reports?type=upi&value=a%40ybl'))).status;
    expect(last).toBe(429);
    const post = await postReport(
      req('/api/reports', { type: 'upi', value: 'a@ybl', category: 'other' }),
    );
    expect(post.status).toBe(429);
  });

  it('every quota-spending endpoint answers 429 with retry-after when over its limit', async () => {
    const cases: [string, () => Promise<Response>, number][] = [
      ['ai/analyze', () => aiAnalyze(req('/api/ai/analyze', {})), 20],
      ['ai/vision', () => aiVision(req('/api/ai/vision', {})), 20],
      ['ask', () => ask(req('/api/ask', {})), 20],
      ['expand', () => expand(req('/api/expand?url=http%3A%2F%2F10.0.0.1%2F')), 60],
      ['domain-age', () => domainAge(req('/api/domain-age?domain=-bad-')), 60],
    ];
    for (const [name, call, limit] of cases) {
      resetRateLimits();
      for (let i = 0; i < limit; i++) await call();
      const res = await call();
      expect(res.status, name).toBe(429);
      expect(res.headers.get('retry-after'), name).toBeTruthy();
    }
  });
});

describe('same origin only', () => {
  it('no API response carries CORS headers, and OPTIONS is not handled', async () => {
    setAiProviders([provider('groq', GOOD)]);
    const responses = [
      await health(req('/api/health')),
      await aiAnalyze(req('/api/ai/analyze', AI_BODY)),
      await expand(req('/api/expand?url=http%3A%2F%2F10.0.0.1%2F')),
      await ask(req('/api/ask', { question: 'pin?', lang: 'en', faqIds: [] })),
    ];
    for (const r of responses)
      for (const h of r.headers.keys()) expect(h.startsWith('access-control-')).toBe(false);
    const modules = await Promise.all([
      import('../health.js'),
      import('../ai/analyze.js'),
      import('../ai/vision.js'),
      import('../ask.js'),
      import('../expand.js'),
      import('../domain-age.js'),
      import('../reports.js'),
    ]);
    for (const m of modules) expect('OPTIONS' in m).toBe(false);
  });
});

describe('logs', () => {
  it('never contain message text, URLs, values or IPs', async () => {
    vi.stubEnv('VITEST', ''); // logEvent is silent under tests; switch it on
    vi.stubEnv('KV_REST_API_URL', 'https://redis.test');
    vi.stubEnv('KV_REST_API_TOKEN', 'token');
    const lines: string[] = [];
    for (const k of ['log', 'info', 'warn', 'error', 'debug'] as const)
      vi.spyOn(console, k).mockImplementation((...a: unknown[]) => {
        lines.push(a.map(String).join(' '));
      });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new TypeError('offline'))),
    );
    __setRedisFetch(fakeUpstash);
    setAiProviders([provider('groq', GOOD)]);
    setAskProviders([provider('groq', { answer: `Never share your PIN ${MARK}.`, covered: true })]);
    __setVisionProvider({ model: 'v', transcribe: vi.fn(async () => `text ${MARK}`) });

    await aiAnalyze(req('/api/ai/analyze', AI_BODY));
    await ask(
      req('/api/ask', { question: `pin ${MARK}?`, lang: 'en', faqIds: ['faq-pin-sends-money'] }),
    );
    await aiVision(req('/api/ai/vision', { imageBase64: PNG, lang: 'en' }));
    await expand(req(`/api/expand?url=${encodeURIComponent(`http://10.0.0.1/${MARK}`)}`));
    await domainAge(req(`/api/domain-age?domain=${MARK}.com`));
    await getReports(req(`/api/reports?type=upi&value=${MARK}%40ybl`));
    await postReport(req('/api/reports', { type: 'upi', value: `${MARK}@ybl`, category: 'other' }));

    expect(lines.length).toBeGreaterThanOrEqual(7);
    for (const l of lines) {
      expect(l).not.toContain(MARK);
      expect(l).not.toContain(IP);
    }
  });
});
