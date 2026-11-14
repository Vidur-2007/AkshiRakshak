import {
  AnalysisResultSchema,
  INPUT_KINDS,
  LiveScoreSchema,
  type AnalyzeRequest,
  type StageTiming,
} from '@akshi/contracts';
import { describe, expect, it } from 'vitest';
import { buildOcrResult } from '../src/browser';
import { analyze as analyzeOnline, maskPII, parseUpiUri, scoreLive, warmup } from '../src/index';

/** Tests here never touch the network: network extras are switched off unless a test sets them. */
const analyze: typeof analyzeOnline = (req, onStage) =>
  analyzeOnline(
    { ...req, options: { expandLinks: false, domainAge: false, ...req.options } },
    onStage,
  );

const KYC =
  'Dear SBI customer, your account will be blocked today. Update KYC immediately and share the OTP. Call 98765 00001.';

function expectValidSpans(r: Awaited<ReturnType<typeof analyze>>) {
  const spans = [
    ...r.signals.flatMap((s) => s.spans),
    ...r.entities.urls.flatMap((u) => (u.span ? [u.span] : [])),
    ...r.entities.upiIds.flatMap((u) => (u.span ? [u.span] : [])),
    ...r.entities.phones.flatMap((p) => (p.span ? [p.span] : [])),
    ...r.entities.amounts.flatMap((a) => (a.span ? [a.span] : [])),
    ...r.entities.apkMentions,
    ...(r.chat ?? []),
    ...(r.image?.boxes ?? []),
  ];
  for (const s of spans) expect(r.text.slice(s.start, s.end)).toBe(s.text);
}

describe('analyze()', () => {
  it('validates against AnalysisResultSchema for every input kind', async () => {
    const words = ['మీ', 'ఖాతా', 'బ్లాక్', 'అవుతుంది.', 'OTP', 'చెప్పండి'];
    const ocr = buildOcrResult(
      {
        confidence: 81,
        blocks: [
          {
            paragraphs: [
              {
                lines: [
                  {
                    words: words.map((text, i) => ({
                      text,
                      bbox: { x0: i * 100, y0: 10, x1: i * 100 + 90, y1: 50 },
                    })),
                  },
                ],
              },
            ],
          },
        ],
      },
      800,
      200,
      ['te'],
    );
    for (const kind of INPUT_KINDS) {
      const req: AnalyzeRequest = {
        kind,
        lang: 'en',
        text:
          kind === 'chat'
            ? '[12/11/26, 10:02] Ravi: hi\n[12/11/26, 10:03] Me: hello\n[12/11/26, 10:04] Ravi: send otp'
            : KYC,
        url: 'https://bit.ly/abc',
        upiId: 'kyc.update.helpdesk@ybl',
        phone: '98765 00001',
        qrPayload: 'upi://pay?pa=9876500001@ybl&pn=SBI%20Refund&am=4999&tn=receive%20refund',
        collect: {
          requesterUpi: 'sbi.refund.desk@ybl',
          requesterName: 'SBI Refund',
          amount: 5000,
          note: 'Refund approved, enter PIN to receive',
          toldYouWillReceive: true,
          contactedFirst: 'them',
          underPressure: true,
          knowRequester: 'no',
        },
        ocr,
      };
      const r = AnalysisResultSchema.parse(await analyze(req));
      expect(r.kind).toBe(kind);
      expectValidSpans(r);
    }
  });

  it('emits running and done/skipped for every stage, in order, with real timings', async () => {
    const seen: StageTiming[] = [];
    const r = await analyze({ kind: 'message', text: KYC, lang: 'en' }, (s) => seen.push(s));
    expect(r.stages.map((s) => s.stage)).toEqual([
      'read',
      'ocr',
      'links',
      'patterns',
      'model',
      'ai',
    ]);
    expect(seen.filter((s) => s.status === 'running').map((s) => s.stage)).toEqual([
      'read',
      'links',
      'patterns',
    ]);
    expect(r.stages.find((s) => s.stage === 'patterns')?.status).toBe('done');
    expect(r.stages.find((s) => s.stage === 'model')?.status).toBe('skipped'); // @akshi/model stub has no model
    expect(r.latencyMs).toBeGreaterThan(0);
  });

  it('labels signals and explains in the requested language', async () => {
    const r = await analyze({
      kind: 'message',
      text: 'आपका खाता बंद हो जाएगा, OTP बताएं',
      lang: 'hi',
    });
    expect(r.signals.find((s) => s.id === 'ASKS_OTP')?.label).toBe('OTP मांगना');
    expect(r.explanation).toContain('चेतावनी संकेत');
    const ok = await analyze({ kind: 'message', text: 'See you at 5', lang: 'te' });
    expect(ok.explanation).toBe('హెచ్చరిక సంకేతాలు కనిపించలేదు. అయినా మీ OTP లేదా PIN ఎవరికీ చెప్పకండి.');
  });

  it('uses bundled indicators and the user blocklist', async () => {
    const known = await analyze({ kind: 'upi_id', upiId: 'kyc.update.helpdesk@ybl', lang: 'en' });
    expect(known.signals.map((s) => s.id)).toContain('KNOWN_INDICATOR');
    expect(known.entities.upiIds[0]?.indicator?.sampleData).toBe(true);
    const blocked = await analyze({
      kind: 'phone',
      phone: '98765 11111',
      lang: 'en',
      options: { blocklist: ['+919876511111'] },
    });
    expect(blocked.signals.map((s) => s.id)).toContain('BLOCKLISTED');
    expect(blocked.riskScore).toBeGreaterThanOrEqual(80);
    const off = await analyze({
      kind: 'upi_id',
      upiId: 'kyc.update.helpdesk@ybl',
      lang: 'en',
      options: { layers: { indicators: false } },
    });
    expect(off.signals.map((s) => s.id)).not.toContain('KNOWN_INDICATOR');
  });

  it('parses QR payloads and keeps the raw string', async () => {
    const raw = 'upi://pay?pa=9876500001@ybl&pn=SBI%20Refund&am=4999&tn=receive%20refund';
    const r = await analyze({ kind: 'qr', qrPayload: raw, lang: 'en' });
    expect(r.qr).toMatchObject({
      raw,
      valid: true,
      pa: '9876500001@ybl',
      pn: 'SBI Refund',
      am: 4999,
    });
    expect(r.text).toContain('pn=SBI Refund');
    expect(parseUpiUri('UPI://PAY?pa=x@ybl&am=abc&zz=1').issues).toEqual([
      'Malformed amount',
      'Unknown parameter "zz"',
      'Payee UPI ID is not valid',
    ]);
  });

  it('builds chat turns with offsets and per-turn risk', async () => {
    const text =
      '[12/11/26, 10:02] Ravi: hello\n[12/11/26, 10:03] Me: who is this?\n[12/11/26, 10:04] Ravi: your account will be blocked, share the OTP';
    const r = await analyze({ kind: 'chat', text, lang: 'en' });
    expect(r.chat?.map((t) => t.sender)).toEqual(['them', 'me', 'them']);
    expect(r.chat?.[2]?.risk).toBeGreaterThan(r.chat?.[0]?.risk ?? 0);
  });

  it('puts emergency first only when the user says money already left', async () => {
    const collect = (note: string) =>
      analyze({
        kind: 'collect_request',
        lang: 'en',
        collect: {
          note,
          toldYouWillReceive: true,
          contactedFirst: 'them',
          underPressure: false,
          knowRequester: 'no',
        },
      });
    expect((await collect('I already paid Rs 5,000, enter PIN to receive refund')).actions[0]).toBe(
      'emergency',
    );
    const scammer = await analyze({
      kind: 'message',
      lang: 'en',
      text: 'I sent Rs 2,000 to you by mistake, please return it urgently',
    });
    expect(scammer.actions).not.toContain('emergency');
  });

  it('handles empty, huge and mixed input without throwing', async () => {
    AnalysisResultSchema.parse(await analyze({ kind: 'message', text: '', lang: 'hi' }));
    const big = 'otp share karo आपका खाता బ్లాక్ অ্যাকাউন্ট 🙂 [('.repeat(1200);
    const t0 = performance.now();
    const r = await analyze({ kind: 'message', text: big, lang: 'en' });
    expect(performance.now() - t0).toBeLessThan(1000);
    expect(r.text.length).toBeGreaterThan(40_000);
  });

  it('honours an aborted signal', async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    await expect(
      analyze({ kind: 'message', text: KYC, lang: 'en', options: { signal: ctrl.signal } }),
    ).rejects.toThrow();
  });

  it('keeps the model stage stub-safe', async () => {
    await expect(warmup()).resolves.toBeUndefined();
  });
});

describe('scoreLive()', () => {
  it('returns a valid LiveScore that matches analyze() for text without links, brands or phones', async () => {
    const plain = 'Your account will be blocked today. Share the OTP you received immediately.';
    const live = LiveScoreSchema.parse(scoreLive(plain, 'en'));
    const full = await analyze({
      kind: 'message',
      text: plain,
      lang: 'en',
      options: { layers: { indicators: false } },
    });
    expect(live.riskScore).toBe(full.riskScore);
    expect(live.verdict).toBe(full.verdict);
    expect(live.topSignals[0]).toBe(full.signals[0]?.id);
  });

  it('applies floors', () => {
    expect(
      scoreLive('Accept the request and enter your UPI PIN to receive ₹5,000').riskScore,
    ).toBeGreaterThanOrEqual(85);
    expect(scoreLive('Hello, how are you?').verdict).toBe('no_signs');
  });
});

describe('maskPII (P1 smoke; full tests in P3)', () => {
  it('masks UPI IDs, phones, emails, URLs, ID numbers and names', () => {
    const { masked, replacements } = maskPII(
      'Dear Ravi, pay kyc.update.helpdesk@ybl or call 98765 00001, mail a@b.com, see https://netbanking.sbi.co.in/verify?id=1 acct 123456789012',
    );
    expect(masked).toBe(
      'Dear [NAME], pay [UPI_ID] or call [PHONE], mail [EMAIL], see https://sbi.co.in/[PATH] acct [ID_NUMBER]',
    );
    expect(replacements).toBe(6);
  });
});
