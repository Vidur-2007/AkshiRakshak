/**
 * Production smoke check, API half (SPEC_A_ENGINE.md §16 step 3). Run after a deploy:
 *
 *   npm run smoke -- https://<project>.vercel.app
 *
 * Checks the app shell, security headers, /api/health (both providers), link expansion,
 * domain age, the AI second opinion, the grounded assistant and community reports, and
 * validates every reply with the contract schemas. Sends only synthetic sample text.
 * The phone checks (sample scan, QR sample, airplane-mode scan after one visit) stay manual.
 */
import {
  AiAnalyzeResponseSchema,
  AssistantAnswerSchema,
  DomainAgeSchema,
  HealthResponseSchema,
  RedirectChainSchema,
  ReportsGetResponseSchema,
} from '@akshi/contracts';
import type { z } from 'zod';

const base = (process.argv[2] ?? '').replace(/\/+$/, '');
if (!/^https?:\/\/[^/]+$/.test(base)) {
  console.error('usage: npm run smoke -- https://<project>.vercel.app');
  process.exit(2);
}

type Status = 'pass' | 'fail' | 'warn';
const results: { name: string; status: Status; detail: string }[] = [];
const record = (name: string, status: Status, detail: string) => {
  results.push({ name, status, detail });
  const mark = status === 'pass' ? 'PASS' : status === 'warn' ? 'WARN' : 'FAIL';
  console.log(`${mark}  ${name.padEnd(28)} ${detail}`);
};

async function call(
  path: string,
  init: RequestInit = {},
  timeoutMs = 15_000,
): Promise<{ res: Response; body: unknown; ms: number }> {
  const t0 = Date.now();
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: { 'user-agent': 'akshi-smoke/1', ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* HTML or plain text */
  }
  return { res, body, ms: Date.now() - t0 };
}

async function check(name: string, fn: () => Promise<[Status, string]>): Promise<void> {
  try {
    const [status, detail] = await fn();
    record(name, status, detail);
  } catch (err) {
    record(name, 'fail', err instanceof Error ? err.message : String(err));
  }
}

function parsed<T extends z.ZodType>(schema: T, body: unknown): z.infer<T> {
  const r = schema.safeParse(body);
  if (!r.success)
    throw new Error(`reply does not match the contract: ${r.error.issues[0]?.message}`);
  return r.data;
}

const post = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

await check('app shell', async () => {
  const { res, body } = await call('/');
  const html = typeof body === 'string' ? body : '';
  if (res.status !== 200 || !/<html/i.test(html)) return ['fail', `HTTP ${res.status}`];
  const sw = await call('/sw.js').catch(() => null);
  const manifest = await call('/manifest.webmanifest').catch(() => null);
  const offline = sw?.res.status === 200 ? 'service worker served' : 'no /sw.js (offline mode?)';
  return [
    sw?.res.status === 200 ? 'pass' : 'warn',
    `HTTP 200, ${offline}, manifest ${manifest?.res.status === 200 ? 'ok' : 'missing'}`,
  ];
});

await check('security headers', async () => {
  const { res } = await call('/');
  const missing = ['x-content-type-options', 'referrer-policy', 'permissions-policy'].filter(
    (h) => !res.headers.get(h),
  );
  return missing.length ? ['fail', `missing ${missing.join(', ')}`] : ['pass', 'all present'];
});

await check('/api/health', async () => {
  const { res, body } = await call('/api/health');
  const h = parsed(HealthResponseSchema, body);
  const both = h.ai.groq && h.ai.gemini;
  return [
    res.status === 200 && both ? 'pass' : 'fail',
    `engine ${h.version}, groq ${h.ai.groq}, gemini ${h.ai.gemini}`,
  ];
});

await check('/api/expand', async () => {
  // a real, harmless redirect: http → https
  const { res, body, ms } = await call(
    `/api/expand?url=${encodeURIComponent('http://github.com/')}`,
  );
  if (res.status !== 200) return ['fail', `HTTP ${res.status} ${JSON.stringify(body)}`];
  const c = parsed(RedirectChainSchema, body);
  return [
    c.hops.length >= 1 && c.finalUrl.startsWith('https://') ? 'pass' : 'fail',
    `${c.hops.length} hop(s) → ${c.finalUrl} in ${ms} ms`,
  ];
});

await check('/api/expand blocks private', async () => {
  // the cloud metadata address: must be refused before any connection (no hops)
  const { res, body } = await call(
    `/api/expand?url=${encodeURIComponent('http://169.254.169.254/')}`,
  );
  if (res.status === 400) return ['pass', 'refused (400)'];
  const c = parsed(RedirectChainSchema, body);
  return c.hops.length === 0 && c.error?.startsWith('blocked')
    ? ['pass', `refused before connecting (${c.error})`]
    : ['fail', `HTTP ${res.status}, ${c.hops.length} hop(s), error ${c.error ?? 'none'}`];
});

await check('/api/domain-age', async () => {
  const { res, body, ms } = await call('/api/domain-age?domain=example.com');
  if (res.status !== 200) return ['fail', `HTTP ${res.status}`];
  const a = parsed(DomainAgeSchema, body);
  return a.ageDays !== undefined
    ? ['pass', `example.com ${a.ageDays} days old (${ms} ms)`]
    : ['warn', `no age (${a.error ?? 'unknown'}) — RDAP may be slow`];
});

await check('/api/ai/analyze', async () => {
  const { res, body, ms } = await call(
    '/api/ai/analyze',
    post({
      maskedText:
        'Dear Customer, your bank account will be BLOCKED today. Update KYC at http://bank-kyc-update.example and share the OTP. Call [PHONE].',
      kind: 'message',
      lang: 'en',
      ruleSignals: ['THREAT_BLOCK', 'ASKS_OTP', 'URGENCY'],
      localCategory: 'fake_kyc',
      localScore: 80,
    }),
    20_000,
  );
  if (res.status !== 200) return ['fail', `HTTP ${res.status} ${JSON.stringify(body)}`];
  const a = parsed(AiAnalyzeResponseSchema, body);
  return [
    a.likelihood >= 60 ? 'pass' : 'warn',
    `${a.provider}/${a.model}: likelihood ${a.likelihood}, ${a.category ?? 'no category'} (${ms} ms)`,
  ];
});

await check('/api/ask', async () => {
  const { res, body, ms } = await call(
    '/api/ask',
    post({
      question: 'Do I need my PIN to receive money?',
      lang: 'en',
      faqIds: ['faq-pin-sends-money'],
    }),
    20_000,
  );
  if (res.status !== 200) return ['fail', `HTTP ${res.status} ${JSON.stringify(body)}`];
  const a = parsed(AssistantAnswerSchema, body);
  return [
    a.sources.includes('faq-pin-sends-money') ? 'pass' : 'warn',
    `${a.answer.split(/\s+/).length} words, sources ${a.sources.join(', ') || 'none'} (${ms} ms)`,
  ];
});

await check('/api/reports', async () => {
  const { res, body } = await call('/api/reports?type=upi&value=smoke.test%40okaxis');
  if (res.status === 503) return ['warn', 'not configured (add the Upstash integration)'];
  const r = parsed(ReportsGetResponseSchema, body);
  return [res.status === 200 ? 'pass' : 'fail', `reports ${r.reports}`];
});

const failed = results.filter((r) => r.status === 'fail').length;
const warned = results.filter((r) => r.status === 'warn').length;
console.log(
  `\n${results.length - failed - warned} passed, ${warned} warnings, ${failed} failed — ${base}`,
);
process.exitCode = failed ? 1 : 0;
