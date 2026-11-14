import { describe, expect, it } from 'vitest';
import {
  AnalysisResultSchema,
  INPUT_KINDS,
  LiveScoreSchema,
  OcrResultSchema,
  SIGNAL_IDS,
  type AnalysisResult,
  type AnalyzeRequest,
  type StageTiming,
} from '@akshi/contracts';
import {
  actionText,
  analyze,
  apiHealth,
  askAssistant,
  categoryText,
  detectInputKind,
  inspectUrl,
  lookupIndicator,
  maskPII,
  parseUpiUri,
  scoreLive,
  signalText,
} from '../src/index';
import { ocrImage } from '../src/browser';

function expectValidSpans(r: AnalysisResult) {
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

const KYC =
  'Dear Customer, your SBI account will be BLOCKED today due to pending KYC. Update KYC at http://sbi-kyc-update.xyz/verify and share the OTP. Call 98765 00001.';
const OTP = '482913 is your OTP for Rs 2,499.00 at AMAZON. Do not share your OTP with anyone.';

describe('engine stub: analyze', () => {
  it('builds keyword signals with real spans on the input', async () => {
    const r = AnalysisResultSchema.parse(await analyze({ kind: 'message', text: KYC, lang: 'en' }));
    expect(r.verdict).toBe('scam');
    expect(r.signals.map((s) => s.id)).toEqual(
      expect.arrayContaining(['ASKS_OTP', 'THREAT_BLOCK', 'BANK_IMPERSONATION', 'SUSPICIOUS_LINK']),
    );
    expect(r.entities.urls[0]?.registrableDomain).toBe('sbi-kyc-update.xyz');
    expect(r.entities.phones[0]?.e164).toBe('+919876500001');
    expectValidSpans(r);
  });

  it('gives a genuine OTP SMS no warning signs', async () => {
    const r = await analyze({ kind: 'message', text: OTP, lang: 'en' });
    expect(r.verdict).toBe('no_signs');
    expect(r.category).toBeNull();
    expect(r.actions).toEqual(['no_action_needed']);
    expect(r.signals[0]?.id).toBe('SAFETY_ADVICE');
  });

  it('returns schema-valid results for every input kind', async () => {
    const ocr = await ocrImage(new Blob(), ['te']);
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
          note: 'Refund approved, enter PIN',
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

  it('reports every stage through onStage', async () => {
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
  });

  it('handles empty and huge input', async () => {
    AnalysisResultSchema.parse(await analyze({ kind: 'message', text: '', lang: 'hi' }));
    const big = 'otp '.repeat(12_500);
    const r = await analyze({ kind: 'message', text: big, lang: 'en' });
    expect(r.text.length).toBeGreaterThan(40_000);
  });

  it('honours an aborted signal', async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    await expect(
      analyze({ kind: 'message', text: KYC, lang: 'en', options: { signal: ctrl.signal } }),
    ).rejects.toThrow();
  });
});

describe('engine stub: other functions', () => {
  it('scoreLive is consistent with analyze', async () => {
    const live = LiveScoreSchema.parse(scoreLive(KYC));
    const full = await analyze({ kind: 'message', text: KYC, lang: 'en' });
    expect(live.riskScore).toBe(full.riskScore);
    expect(live.verdict).toBe(full.verdict);
  });

  it('detectInputKind', () => {
    expect(detectInputKind('upi://pay?pa=a@ybl').kind).toBe('qr');
    expect(detectInputKind('kyc.update.helpdesk@ybl').kind).toBe('upi_id');
    expect(detectInputKind('https://sbi-kyc-update.xyz').kind).toBe('url');
    expect(detectInputKind('sbi-kyc-update.xyz').kind).toBe('url');
    expect(detectInputKind('+91 98765 00001').kind).toBe('phone');
    expect(detectInputKind('[12/11/26, 10:02] A: hi\n[12/11/26, 10:03] B: yo').kind).toBe('chat');
    expect(detectInputKind('From: a@b.com\nSubject: hi\n\nbody').kind).toBe('email');
    expect(detectInputKind(KYC).kind).toBe('message');
  });

  it('parseUpiUri', () => {
    const p = parseUpiUri(
      'upi://pay?pa=9876500001@ybl&pn=SBI%20Refund&am=4999&tn=receive%20refund&cu=INR',
    );
    expect(p).toMatchObject({
      valid: true,
      pa: '9876500001@ybl',
      pn: 'SBI Refund',
      am: 4999,
      tn: 'receive refund',
      cu: 'INR',
    });
    expect(parseUpiUri('UPI://PAY?pa=x@ybl&am=abc&zz=1').issues).toEqual([
      'Malformed amount',
      'Unknown parameter "zz"',
      'Payee UPI ID is not valid',
    ]);
    expect(parseUpiUri('https://example.com').valid).toBe(false);
  });

  it('inspectUrl', async () => {
    const u = await inspectUrl('https://bit.ly/x');
    expect(u.isShortener).toBe(true);
    expect((await inspectUrl('www.sbi.co.in')).registrableDomain).toBe('sbi.co.in');
  });

  it('maskPII', () => {
    const { masked, replacements } = maskPII(
      'Dear Ravi, pay kyc.update.helpdesk@ybl or call 98765 00001, mail a@b.com, see https://sbi-kyc-update.xyz/verify?id=1 acct 123456789012',
    );
    expect(masked).toBe(
      'Dear [NAME], pay [UPI_ID] or call [PHONE], mail [EMAIL], see https://sbi-kyc-update.xyz/[PATH] acct [ID_NUMBER]',
    );
    expect(replacements).toBe(6);
  });

  it('lookupIndicator', () => {
    expect(lookupIndicator('98765 00001')?.reports).toBe(5);
    expect(lookupIndicator('SBI-KYC-UPDATE.XYZ')?.category).toBe('fake_kyc');
    expect(lookupIndicator('nobody@ybl')).toBeNull();
  });

  it('askAssistant answers offline from the FAQ', async () => {
    const a = await askAssistant('Do I need a PIN to receive money?', 'hi');
    expect(a.mode).toBe('offline');
    expect(a.sources).toEqual(['faq-pin-sends-money']);
  });

  it('string lookups cover every id', () => {
    for (const id of SIGNAL_IDS) expect(signalText(id, 'te').label).not.toBe('');
    expect(categoryText('fake_kyc', 'en').name).toBe('Fake KYC update');
    expect(actionText('report_1930', 'bn').href).toBe('tel:1930');
  });

  it('apiHealth falls back to offline without a server', async () => {
    expect(await apiHealth()).toEqual({ online: false, ai: false });
  });

  it('ocrImage returns the fixture OCR after ~300 ms', async () => {
    const progress: number[] = [];
    const t0 = Date.now();
    const r = OcrResultSchema.parse(await ocrImage(new Blob(), [], (p) => progress.push(p)));
    expect(Date.now() - t0).toBeGreaterThanOrEqual(250);
    expect(progress.at(-1)).toBe(1);
    expect(r.boxes.length).toBeGreaterThan(0);
  });
});
