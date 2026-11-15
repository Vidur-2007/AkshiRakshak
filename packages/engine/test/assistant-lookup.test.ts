import {
  AnalysisResultSchema,
  AssistantAnswerSchema,
  LANGS,
  type OcrResult,
} from '@akshi/contracts';
import { FAQ } from '@akshi/content';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { searchFaq, tokenize } from '../src/assistant';
import { analyze as analyzeOnline, askAssistant, isWeakOcr, setApiBase } from '../src/index';

const analyze: typeof analyzeOnline = (req, cb) =>
  analyzeOnline({ ...req, options: { expandLinks: false, domainAge: false, ...req.options } }, cb);
const ids = (r: { signals: { id: string }[] }) => r.signals.map((s) => s.id);

afterEach(() => {
  vi.unstubAllGlobals();
  setApiBase('');
});

describe('assistant (§12.4)', () => {
  it('answers offline for every FAQ item, from its own question, in every language it has', async () => {
    for (const item of FAQ) {
      for (const lang of LANGS) {
        const q = item.q[lang];
        if (!q) continue;
        const a = AssistantAnswerSchema.parse(await askAssistant(q, lang));
        expect(a.sources[0], `${item.id} [${lang}]`).toBe(item.id);
        expect(a.mode).toBe('offline');
        expect(a.answer).toBe(item.a[lang] ?? item.a.en);
      }
    }
  });

  it('finds topics from paraphrases, romanised Hindi and the answer wording', async () => {
    const cases: [string, string, 'en' | 'hi' | 'te' | 'bn'][] = [
      ['someone sent me a QR so I can get paid', 'faq-qr-receive', 'en'],
      ['caller says police will arrest me on video call', 'faq-digital-arrest', 'en'],
      ['where do I complain after losing money', 'faq-how-to-report', 'en'],
      ['bank executive asking for my otp', 'faq-bank-never-asks-otp', 'en'],
      ['kya paise lene ke liye PIN chahiye', 'faq-pin-sends-money', 'hi'],
      ['डिजिटल अरेस्ट कॉल', 'faq-digital-arrest', 'hi'],
    ];
    for (const [q, id, lang] of cases) expect((await askAssistant(q, lang)).sources[0], q).toBe(id);
  });

  it('falls back to English documents and returns up to 3 ids for grounding', () => {
    const top = searchFaq('PIN QR receive money', 'bn', 3);
    expect(top.length).toBeGreaterThan(1);
    expect(top.length).toBeLessThanOrEqual(3);
    expect(tokenize('Codes, PINs & the OTP!')).toEqual(['code', 'pin', 'otp']);
  });

  it('says when the guide does not cover a question', async () => {
    const a = await askAssistant('my cat is sick', 'te');
    expect(a.sources).toEqual([]);
    expect(a.answer).toContain('1930');
  });

  it('online: sends the masked question and the top-3 ids, falls back offline on failure', async () => {
    setApiBase('http://api.test');
    let body: { question: string; faqIds: string[] } | null = null;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_u: string, init?: RequestInit) => {
        body = JSON.parse(String(init?.body));
        return new Response(
          JSON.stringify({
            answer: 'Online answer. Call 1930.',
            sources: ['faq-pin-sends-money'],
            mode: 'online',
            provider: 'groq',
          }),
        );
      }),
    );
    const a = await askAssistant(
      'I got a request from ravi.k@ybl, do I need my PIN to receive money?',
      'en',
      { online: true },
    );
    expect(a).toMatchObject({
      mode: 'online',
      provider: 'groq',
      answer: 'Online answer. Call 1930.',
    });
    expect(body!.question).toContain('[UPI_ID]');
    expect(body!.question).not.toContain('ravi.k@ybl');
    expect(body!.faqIds[0]).toBe('faq-pin-sends-money');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('nope', { status: 503 })),
    );
    expect(
      (await askAssistant('do I need my PIN to receive money?', 'en', { online: true })).mode,
    ).toBe('offline');
  });
});

describe('lookups (upi_id, phone, url)', () => {
  it('explains a bundled indicator match even with no other signal', async () => {
    const r = AnalysisResultSchema.parse(
      await analyze({ kind: 'upi_id', upiId: 'kyc.update.helpdesk@ybl', lang: 'en' }),
    );
    expect(ids(r)).toContain('KNOWN_INDICATOR');
    expect(r.entities.upiIds[0]?.indicator).toMatchObject({ source: 'bundled', sampleData: true });
    expect(r.explanation).toMatch(
      /^This UPI ID appears in \d+ scam reports \(.+, sample data\)\.$/,
    );
    expect(r.category).toBe('fake_kyc');
    expect(r.verdict).toBe('scam');
  });

  it('explains a phone number from the indicators in the user language', async () => {
    const r = await analyze({ kind: 'phone', phone: '+91 98765 00001', lang: 'hi' });
    expect(r.entities.phones[0]?.indicator?.reports).toBeGreaterThan(0);
    expect(r.explanation).toContain('नमूना डेटा');
  });

  it('explains a blocked value', async () => {
    const r = await analyze({
      kind: 'phone',
      phone: '98765 11111',
      lang: 'en',
      options: { blocklist: ['9876511111'] },
    });
    expect(ids(r)).toContain('BLOCKLISTED');
    expect(r.explanation).toBe('You blocked this number earlier.');
    expect(r.riskScore).toBeGreaterThanOrEqual(80);
  });

  it('never calls an unknown value safe', async () => {
    for (const [kind, v] of [
      ['upi_id', 'ravi.kumar@okaxis'],
      ['phone', '98765 43210'],
      ['url', 'https://example.org'],
    ] as const) {
      const r = await analyze({
        kind,
        lang: 'en',
        ...(kind === 'upi_id' ? { upiId: v } : kind === 'phone' ? { phone: v } : { url: v }),
      });
      expect(r.verdict, v).toBe('no_signs');
      expect(r.explanation).toMatch(
        /^No reports found for this (UPI ID|number|website) in our sample list\. That does not prove it is genuine/,
      );
      expect(r.explanation.toLowerCase()).not.toContain('safe');
    }
  });

  it('keeps link warnings for a lookalike website', async () => {
    const r = await analyze({
      kind: 'url',
      url: 'http://sbi-kyc-update.xyz/verify',
      lang: 'en',
      options: { layers: { indicators: false } },
    });
    expect(ids(r)).toContain('LOOKALIKE_DOMAIN');
    expect(r.verdict).toBe('scam');
  });
});

describe('screenshots: collect screens and weak OCR (§10)', () => {
  const ocr = (text: string, confidence = 85): OcrResult => ({
    text,
    boxes: [],
    width: 1080,
    height: 1920,
    confidence,
    langs: ['en'],
  });

  it('recognises a collect-request screen with refund wording', async () => {
    const r = await analyze({
      kind: 'image',
      lang: 'en',
      ocr: ocr(
        'refund.help.desk@ybl has requested ₹2,000 Note: Refund approved, receive your money Pay Decline',
      ),
    });
    expect(ids(r)).toEqual(expect.arrayContaining(['COLLECT_REQUEST', 'RECEIVE_WITH_PIN']));
    expect(r.riskScore).toBeGreaterThanOrEqual(85);
    expect(r.explanation).toContain('Entering your UPI PIN always sends money');
    expect(r.actions[0]).toBe('decline_request');
  });

  it('recognises Hindi, Telugu and Bengali collect screens', async () => {
    for (const [lang, text] of [
      ['hi', 'ravi.k@ybl ने ₹1,500 का भुगतान का अनुरोध किया है। भुगतान करें अस्वीकार करें'],
      ['te', 'ravi.k@ybl ₹1,500 అభ్యర్థించారు చెల్లించండి తిరస్కరించు'],
      ['bn', 'ravi.k@ybl ₹1,500 অনুরোধ করেছেন পেমেন্ট করুন প্রত্যাখ্যান'],
    ] as const) {
      const r = await analyze({ kind: 'image', lang, ocr: ocr(text) });
      expect(ids(r), lang).toContain('COLLECT_REQUEST');
    }
  });

  it('does not treat a payment receipt as a collect request', async () => {
    const r = await analyze({
      kind: 'image',
      lang: 'en',
      ocr: ocr('Payment successful ₹250 paid to Sharma Store UPI transaction ID 600000000001'),
    });
    expect(ids(r)).not.toContain('COLLECT_REQUEST');
  });

  it('flags weak OCR and caps confidence', async () => {
    expect(isWeakOcr({ confidence: 40, text: 'plenty of readable text here' })).toBe(true);
    expect(isWeakOcr({ confidence: 90, text: 'short' })).toBe(true);
    expect(isWeakOcr({ confidence: 90, text: 'Your account will be blocked today' })).toBe(false);
    const r = await analyze({
      kind: 'image',
      lang: 'en',
      ocr: ocr('Your account will be blocked today. Share the OTP now', 30),
    });
    expect(r.confidence).toBeLessThanOrEqual(0.6);
  });
});
