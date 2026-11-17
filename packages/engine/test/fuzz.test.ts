/**
 * Fuzz test (SPEC_A_ENGINE.md §15): 1,000 seeded random inputs — huge text (50 KB), emoji and
 * ZWJ sequences, mixed scripts, lone surrogates, control and bidi characters, unbalanced
 * brackets, broken URLs, malformed upi:// strings, empty input — across every input kind.
 * analyze() must never throw, must return a contract-valid result in < 1 s, and nothing the UI
 * shows may contain a raw error. The other synchronous entry points must not throw either.
 */
import {
  AnalysisResultSchema,
  type AnalyzeRequest,
  type InputKind,
  type Lang,
} from '@akshi/contracts';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  analyze,
  createLiveListener,
  detectInputKind,
  inspectUrl,
  maskPII,
  parseUpiUri,
  scoreLive,
  searchFaq,
  warmup,
} from '../src/index';

// ── seeded PRNG (mulberry32) so failures reproduce ──
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const R = rng(20261115);
const int = (n: number) => Math.floor(R() * n);
const pick = <T>(xs: readonly T[]): T => xs[int(xs.length)]!;
const rep = (n: number, f: () => string) => Array.from({ length: n }, f).join('');

const RANGES: [number, number][] = [
  [0x20, 0x7e], // ASCII
  [0x0900, 0x097f], // Devanagari
  [0x0c00, 0x0c7f], // Telugu
  [0x0980, 0x09ff], // Bengali
  [0x0600, 0x06ff], // Arabic (RTL)
  [0x4e00, 0x4e80], // CJK
  [0x1f300, 0x1f6ff], // emoji
  [0xff01, 0xff5e], // full-width ASCII
  [0x0400, 0x04ff], // Cyrillic (homoglyphs)
];
const SPECIAL = [
  '‍',
  '​',
  '‎',
  '‮',
  '﻿',
  '\u0000',
  '\u0007',
  '\t',
  '\r\n',
  '\n',
  '\ud800',
  '\udfff', // lone surrogates
  '👨‍👩‍👧‍👦',
  '🏳️‍🌈',
  '1️⃣',
  '₹',
  '©',
  '́',
  '(',
  ')',
  '[',
  ']',
  '{',
  '}',
  '((((',
  ']]]]',
  '"',
  "'",
  '\\',
  '<script>',
  '%',
  '%%',
  '%E0%A4',
  '&#x0;',
  '${',
  '`',
  '|',
  '^',
  '*',
  '+',
  '?',
];
const WORDS = [
  'KYC',
  'OTP',
  'PIN',
  'UPI',
  'block',
  'urgent',
  'refund',
  'आपका खाता',
  'तुरंत',
  'OTP बताएं',
  'మీ ఖాతా',
  'వెంటనే',
  'আপনার অ্যাকাউন্ট',
  'এখনই',
  'aapka khata',
  'turant',
  'lottery',
  'customs',
  '₹4,999',
  '98765 00001',
  '+91-98765-00002',
  'call now',
  'do not share',
  'AnyDesk',
  'APK',
];
const BROKEN_URLS = [
  'http://',
  'https://',
  'http:///',
  'http://.',
  'http://..com',
  'http://-x-.com',
  'http://x..y',
  'http://[::1',
  'http://[zz::1]/',
  'http://999.999.999.999/',
  'http://0x7f.1/',
  'http://user:pass@',
  'https://xn--/',
  'https://xn--zz-.com',
  'http://a.b.c.d.e.f.g.h.i.j.k.l.m.n.o.p',
  'hxxp://evil[.]com',
  'www.',
  'www..com',
  'bit.ly/',
  'http://%00.com',
  'http://例え.テスト/%%%',
  'javascript:alert(1)',
  'data:text/html,<b>',
  'http://' + 'a'.repeat(300) + '.com',
  'https://sbi.co.in.' + 'x'.repeat(70) + '.xyz',
  'http://ex ample.com',
  'https://sbі.co.in/login',
  'ftp://files',
  'mailto:',
  'tel:',
  'intent://',
];
const BROKEN_UPI = [
  'upi://',
  'upi://pay',
  'upi://pay?',
  'upi://pay?pa=',
  'upi://pay?pa=@',
  'upi://pay?pa=a@',
  'upi://pay?pa=@ybl&am=-5',
  'upi://pay?pa=x@ybl&am=NaN',
  'upi://pay?pa=x@ybl&am=1e309',
  'upi://pay?pa=x@ybl&am=99999999999999999999',
  'upi://pay?pa=x%ZZ@ybl',
  'upi://pay?pa=x@ybl&pn=%',
  'upi://pay?pa=x@ybl&&&&&',
  'upi://pay?pa=x@ybl&pa=y@okaxis',
  'UPI://PAY?PA=X@YBL&AM=1',
  'upi://collect?pa=x@ybl&am=500&tn=refund',
  'upi://mandate?pa=x@ybl',
  'upi:pay?pa=x@ybl',
  'upi://pay?pa=' + 'x'.repeat(5000) + '@ybl',
  'upi://pay?tn=' + '%F0%9F'.repeat(200),
];
const LANGS: Lang[] = ['en', 'hi', 'te', 'bn'];
const KINDS: InputKind[] = [
  'message',
  'chat',
  'email',
  'url',
  'upi_id',
  'phone',
  'qr',
  'image',
  'collect_request',
];

function randomChars(n: number): string {
  let s = '';
  for (let i = 0; i < n; i++) {
    if (R() < 0.08) {
      s += pick(SPECIAL);
      continue;
    }
    const [lo, hi] = pick(RANGES);
    s += String.fromCodePoint(lo + int(hi - lo + 1));
  }
  return s;
}

function randomText(): string {
  switch (int(9)) {
    case 0:
      return '';
    case 1:
      return rep(1 + int(5), () => pick([' ', '\n', '\t', '​']));
    case 2:
      return randomChars(1 + int(400));
    case 3:
      return rep(3 + int(30), () => `${pick(WORDS)}${pick([' ', '', '!!', '\n', pick(SPECIAL)])}`);
    case 4:
      return rep(1 + int(6), () => `${pick(WORDS)} ${pick(BROKEN_URLS)} `);
    case 5:
      return rep(1 + int(4), () => `${pick(WORDS)} ${pick(BROKEN_UPI)} `);
    case 6: // chat-shaped with broken timestamps
      return rep(
        2 + int(8),
        () =>
          pick([
            `[${int(40)}/${int(14)}/${int(100)}, ${int(25)}:${int(70)} PM] `,
            `${int(40)}/${int(14)}/2026, ${int(30)}:${int(99)} - `,
            'Ravi: ',
            'You: ',
            '',
          ]) + `${pick(WORDS)} ${randomChars(int(40))}\n`,
      );
    case 7: // email-shaped with broken headers
      return `From: ${pick(['', '"', '<>', '"SBI" <x@', 'a@b', randomChars(10)])}\nReply-To: ${pick(['', '<', 'z@evil.xyz'])}\nSubject: ${randomChars(20)}\n\n${pick(WORDS)} ${pick(BROKEN_URLS)} invoice.zip.exe`;
    default:
      return (
        rep(1 + int(10), () => pick(['(', '[', '{', '<', ')', ']', '}', '>'])) + randomChars(50)
      );
  }
}

/** 50 KB of mixed content (a pasted chat export or a long email). */
function hugeText(): string {
  let s = '';
  while (s.length < 50_000)
    s += `${pick(WORDS)} ${R() < 0.1 ? pick(BROKEN_URLS) : ''} ${randomChars(30)}\n`;
  return s.slice(0, 50_000);
}

function randomRequest(i: number): AnalyzeRequest {
  const kind = KINDS[i % KINDS.length]!;
  const lang = pick(LANGS);
  const options = { expandLinks: false, domainAge: false } as const;
  // every 25th input: 50 KB pasted text (40 in total)
  if (i % 25 === 0)
    return { kind: pick(['message', 'chat', 'email'] as const), lang, text: hugeText(), options };
  const text = randomText();
  switch (kind) {
    case 'url':
      return { kind, lang, url: R() < 0.7 ? pick(BROKEN_URLS) : text, options };
    case 'upi_id':
      return {
        kind,
        lang,
        upiId: pick([
          '',
          '@',
          'a@',
          '@ybl',
          'x@@ybl',
          'x@ybl',
          randomChars(20),
          text.slice(0, 300),
        ]),
        options,
      };
    case 'phone':
      return {
        kind,
        lang,
        phone: pick([
          '',
          '+',
          '+91',
          '0000000000',
          '+91 98765 0000',
          '१२३४५६७८९०',
          randomChars(15),
        ]),
        options,
      };
    case 'qr':
      return { kind, lang, qrPayload: R() < 0.6 ? pick(BROKEN_UPI) : text, options };
    case 'image': {
      const conf = int(101);
      return {
        kind,
        lang,
        ocr: {
          text,
          boxes: [],
          width: int(4000),
          height: int(4000),
          confidence: conf,
          langs: [lang],
        },
        options,
      };
    }
    case 'collect_request':
      return {
        kind,
        lang,
        collect: {
          requesterUpi: pick(['', '@', 'x@ybl', randomChars(12)]),
          requesterName: pick(['', randomChars(30), 'SBI Refund Dept']),
          amount: pick([0, 1, 4999, 1e12, Number.MAX_SAFE_INTEGER]),
          note: text.slice(0, 2000),
          toldYouWillReceive: R() < 0.5,
          contactedFirst: pick(['them', 'me', 'unknown'] as const),
          underPressure: R() < 0.5,
          knowRequester: pick(['yes', 'no', 'unsure'] as const),
        },
        options,
      };
    default:
      return { kind, lang, text, options };
  }
}

/** Raw error leaking into UI copy: error names, stack frames, JS placeholders. */
const RAW_ERROR =
  /\b(?:TypeError|RangeError|SyntaxError|ReferenceError|Error:|Exception|undefined|NaN|Infinity|null)\b|\[object \w+\]|\bat \S+ \(.+:\d+:\d+\)/;

/** UI-facing strings that the engine writes (not the user's own input). */
function uiStrings(r: Awaited<ReturnType<typeof analyze>>): string[] {
  return [
    r.explanation,
    ...r.signals.flatMap((s) => [s.label, s.detail]),
    ...r.claimVsReality.flatMap((c) => [c.claim, c.reality]),
  ];
}

const N = 1_000;
const REQUESTS = Array.from({ length: N }, (_, i) => randomRequest(i));

describe('fuzz (§15)', () => {
  // the first scan would otherwise include loading the model JSON (warmup() does that in the app)
  beforeAll(() => warmup(), 60_000);

  it(`analyze() survives ${N} random inputs, each < 1 s, contract-valid, no raw errors`, async () => {
    let slowest = 0;
    let huge = 0;
    for (let i = 0; i < N; i++) {
      const req = REQUESTS[i]!;
      const t0 = performance.now();
      let res: Awaited<ReturnType<typeof analyze>>;
      try {
        res = await analyze(req);
      } catch (err) {
        throw new Error(`#${i} (${req.kind}) threw: ${String(err)}`, { cause: err });
      }
      let ms = performance.now() - t0;
      if (ms >= 1000) {
        // a GC pause or a busy CPU (tests run in parallel) can spike one run; a slow input stays slow
        const t1 = performance.now();
        await analyze(req);
        ms = performance.now() - t1;
      }
      slowest = Math.max(slowest, ms);
      if ((req.text?.length ?? 0) >= 50_000) huge++;
      expect(ms, `#${i} (${req.kind}) took ${ms.toFixed(0)} ms`).toBeLessThan(1000);
      const parsed = AnalysisResultSchema.safeParse(res);
      expect(parsed.success, `#${i} (${req.kind}) ${parsed.error?.issues[0]?.message}`).toBe(true);
      expect(Number.isInteger(res.riskScore)).toBe(true);
      for (const s of uiStrings(res))
        expect(RAW_ERROR.test(s), `#${i} (${req.kind}) UI text: ${s.slice(0, 120)}`).toBe(false);
    }
    expect(huge).toBeGreaterThanOrEqual(20);
    console.log(`fuzz: ${N} inputs (${huge} × 50 KB), slowest ${slowest.toFixed(0)} ms`);
  }, 300_000);

  it('the synchronous helpers never throw on the same inputs', () => {
    const listener = createLiveListener('hi');
    for (const req of REQUESTS) {
      const t = req.text ?? req.url ?? req.upiId ?? req.phone ?? req.qrPayload ?? '';
      expect(() => scoreLive(t, req.lang)).not.toThrow();
      expect(() => detectInputKind(t)).not.toThrow();
      expect(() => maskPII(t)).not.toThrow();
      expect(() => parseUpiUri(t)).not.toThrow();
      expect(() => searchFaq(t.slice(0, 2000), req.lang)).not.toThrow();
      expect(() => listener.push(t.slice(0, 5000), R() < 0.5)).not.toThrow();
    }
  }, 120_000);

  it('inspectUrl() resolves for every broken URL', async () => {
    for (const u of BROKEN_URLS)
      await expect(inspectUrl(u, { expand: false, domainAge: false })).resolves.toBeDefined();
  });
});
