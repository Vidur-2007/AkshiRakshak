import {
  AnalysisResultSchema,
  normalizeText,
  type AnalyzeRequest,
  type CollectRequestInput,
} from '@akshi/contracts';
import { describe, expect, it } from 'vitest';
import { analyze as analyzeOnline, parseUpiUri } from '../src/index';
import { analyzeCollect, collectToText } from '../src/upi/collect';
import { looksPersonal, pspOf } from '../src/upi/handles';
import { analyzeQr, classifyQr } from '../src/upi/qr';

const analyze = (req: AnalyzeRequest) =>
  analyzeOnline({
    ...req,
    options: {
      expandLinks: false,
      domainAge: false,
      layers: { indicators: false },
      ...req.options,
    },
  });
const ids = (r: { signals: { id: string }[] }) => r.signals.map((s) => s.id);

describe('PSP handles and looksPersonal (§6.3)', () => {
  it('maps handles to apps', () => {
    expect(pspOf('ybl')).toBe('PhonePe');
    expect(pspOf('OKAXIS')).toBe('Google Pay');
    expect(pspOf('paytm')).toBe('Paytm');
    expect(pspOf('apl')).toBe('Amazon Pay');
    expect(pspOf('upi')).toBe('BHIM');
    expect(pspOf('nonsense')).toBeUndefined();
  });

  it('treats mobile numbers and names as personal, merchant markers as not', () => {
    expect(looksPersonal('9876500001')).toBe(true);
    expect(looksPersonal('ravi.kumar88')).toBe(true);
    expect(looksPersonal('sbi.refund.desk')).toBe(true);
    expect(looksPersonal('paytmqr281005050101')).toBe(false);
    expect(looksPersonal('sharma.store')).toBe(false);
    expect(looksPersonal('q123456789')).toBe(false);
  });
});

describe('UPI_NAME_MISMATCH', () => {
  it('fires for a brand in the local part of a personal UPI ID', async () => {
    const r = await analyze({ kind: 'upi_id', upiId: 'sbi.kyc.update@ybl', lang: 'en' });
    expect(ids(r)).toEqual(expect.arrayContaining(['UPI_NAME_MISMATCH', 'PERSONAL_UPI_HANDLE']));
    expect(r.verdict).not.toBe('no_signs');
    expect(r.entities.brands[0]).toMatchObject({ brand: 'SBI', mismatch: true });
  });

  it('fires when a brand is named right before a personal UPI ID', async () => {
    const r = await analyze({
      kind: 'message',
      text: 'Pay the KYC fee of ₹99 to SBI KYC desk ravi.desk@ybl today.',
      lang: 'en',
    });
    expect(ids(r)).toContain('UPI_NAME_MISMATCH');
    expect(r.claimVsReality.some((c) => c.reality.includes('ravi.desk@ybl'))).toBe(true);
  });

  it('does not fire for a payee in a genuine debit alert', async () => {
    const r = await analyze({
      kind: 'message',
      text: 'HDFC Bank: Rs 500.00 debited from a/c XX1234 on 12-11-26 to VPA ravi.k@ybl (UPI Ref 600000000002). Not you? Call the number on your card.',
      lang: 'en',
    });
    expect(ids(r)).not.toContain('UPI_NAME_MISMATCH');
    expect(r.verdict).toBe('no_signs');
  });

  it('treats a plain personal UPI ID with no claim as no warning signs', async () => {
    const r = await analyze({ kind: 'upi_id', upiId: 'ravi.kumar@okaxis', lang: 'en' });
    expect(r.verdict).toBe('no_signs');
    expect(r.entities.upiIds[0]).toMatchObject({
      psp: 'Google Pay',
      pspKnown: true,
      looksPersonal: true,
    });
  });
});

describe('parseUpiUri (§6.4)', () => {
  it('parses a full payload with percent-encoding', () => {
    expect(
      parseUpiUri(
        'upi://pay?pa=shop.q12345678@ybl&pn=Sharma%20Store&am=250.50&cu=INR&tn=Order%2042&mc=5411&tr=TXN1',
      ),
    ).toMatchObject({
      valid: true,
      pa: 'shop.q12345678@ybl',
      pn: 'Sharma Store',
      am: 250.5,
      cu: 'INR',
      tn: 'Order 42',
      mc: '5411',
      tr: 'TXN1',
      issues: [],
    });
  });

  it('lists issues for missing pa, malformed amounts, unknown params and unusual actions', () => {
    expect(parseUpiUri('upi://pay?pn=Shop').issues).toContain('Missing payee UPI ID (pa)');
    expect(parseUpiUri('upi://pay?pa=a1@ybl&am=12abc').issues).toContain('Malformed amount');
    expect(parseUpiUri('upi://pay?pa=a1@ybl&foo=1').issues).toContain('Unknown parameter "foo"');
    const c = parseUpiUri('upi://collect?pa=a1@ybl');
    expect(c.valid).toBe(false);
    expect(c.issues[0]).toMatch(/Unusual UPI action/);
    expect(parseUpiUri('not a uri').valid).toBe(false);
  });
});

describe('QR analysis', () => {
  it('classifies payloads', () => {
    expect(classifyQr('upi://pay?pa=a@ybl')).toBe('upi');
    expect(classifyQr('https://example.com')).toBe('website');
    expect(classifyQr('hello there')).toBe('text');
  });

  it('flags receive wording in tn/pn, a prefilled amount, and states the payee', () => {
    const raw = 'upi://pay?pa=9876500001@ybl&pn=SBI%20Refund&am=4999&tn=receive%20refund';
    const text = normalizeText(decodeURIComponent(raw));
    const q = analyzeQr(raw, text, 'en');
    expect(q.signals.map((s) => s.id).sort()).toEqual(['PREFILLED_AMOUNT', 'QR_TO_RECEIVE']);
    for (const s of q.signals.flatMap((x) => x.spans))
      expect(text.slice(s.start, s.end)).toBe(s.text);
    expect(q.lead).toBe('This QR pays 9876500001@ybl (shown as "SBI Refund").');
  });

  it('detects receive wording in Hindi, Telugu and Bengali notes', () => {
    for (const tn of ['रिफंड पाएं', 'రీఫండ్ పొందండి', 'রিফান্ড পাবেন']) {
      const raw = `upi://pay?pa=9876500001@ybl&pn=Help&tn=${encodeURIComponent(tn)}`;
      const q = analyzeQr(raw, normalizeText(decodeURIComponent(raw)), 'hi');
      expect(
        q.signals.map((s) => s.id),
        tn,
      ).toContain('QR_TO_RECEIVE');
    }
  });

  it('analyses a QR end to end: payee in the explanation in every language', async () => {
    const qrPayload = 'upi://pay?pa=9876500001@ybl&pn=SBI%20Refund&am=4999&tn=receive%20refund';
    for (const lang of ['en', 'hi', 'te', 'bn'] as const) {
      const r = AnalysisResultSchema.parse(await analyze({ kind: 'qr', qrPayload, lang }));
      expect(r.explanation, lang).toContain('9876500001@ybl');
      expect(r.explanation, lang).toContain('SBI Refund');
      expect(r.riskScore).toBeGreaterThanOrEqual(85);
    }
  });

  it('says a website QR is not a payment', async () => {
    const r = await analyze({ kind: 'qr', qrPayload: 'https://bit.ly/3refund', lang: 'en' });
    expect(r.explanation.startsWith('This QR opens a website, not a payment.')).toBe(true);
    expect(r.verdict).toBe('suspicious');
    expect(r.claimVsReality[0]).toMatchObject({
      claim: 'Looks like a payment QR',
      reality: 'It opens the website bit.ly',
    });
    expect(r.qr).toBeUndefined();
  });

  it('analyses plain-text QR content as a message', async () => {
    const r = await analyze({
      kind: 'qr',
      qrPayload: 'Your account will be blocked, share the OTP now',
      lang: 'en',
    });
    expect(ids(r)).toEqual(expect.arrayContaining(['ASKS_OTP', 'THREAT_BLOCK']));
  });

  it('flags upi://collect payloads as a collect request', async () => {
    const r = await analyze({
      kind: 'qr',
      qrPayload: 'upi://collect?pa=9876500001@ybl&am=2000',
      lang: 'en',
    });
    expect(ids(r)).toContain('COLLECT_REQUEST');
    expect(r.qr?.valid).toBe(false);
  });
});

describe('collect requests (§6.5)', () => {
  const base: CollectRequestInput = {
    toldYouWillReceive: false,
    contactedFirst: 'me',
    underPressure: false,
    knowRequester: 'yes',
  };

  it('composes the analysed text from the form', () => {
    expect(
      collectToText({
        ...base,
        requesterName: 'Ravi',
        requesterUpi: 'ravi@ybl',
        amount: 1500,
        note: 'Dinner',
      }),
    ).toBe('Collect request from Ravi (ravi@ybl) for ₹1,500. Note: Dinner');
  });

  it('"you will receive" → RECEIVE_WITH_PIN, floor 90 and the PIN truth', async () => {
    const r = await analyze({
      kind: 'collect_request',
      lang: 'en',
      collect: {
        ...base,
        toldYouWillReceive: true,
        contactedFirst: 'them',
        knowRequester: 'no',
        requesterUpi: 'helpdesk.refund@ybl',
        amount: 5000,
      },
    });
    expect(r.riskScore).toBeGreaterThanOrEqual(90);
    expect(ids(r)).toContain('RECEIVE_WITH_PIN');
    expect(r.explanation).toBe(
      'Entering your UPI PIN always sends money from your account. You never need a PIN to receive money.',
    );
    expect(r.claimVsReality[0]).toEqual({
      claim: 'You will receive ₹5,000',
      reality: 'Approving this request sends ₹5,000 from your account to helpdesk.refund@ybl',
      mismatch: true,
      signal: 'RECEIVE_WITH_PIN',
    });
    expect(r.actions).toEqual(['decline_request', 'do_not_pay', 'block_sender', 'report_chakshu']);
  });

  it('unknown requester who contacted first → COLLECT_REQUEST with +0.15; pressure → URGENCY', () => {
    const a = analyzeCollect(
      { ...base, contactedFirst: 'them', knowRequester: 'unsure', underPressure: true },
      'Collect request.',
      'en',
      false,
    );
    const collect = a.signals.find((s) => s.id === 'COLLECT_REQUEST');
    expect(collect?.weight).toBeCloseTo(0.35);
    expect(a.signals.map((s) => s.id)).toContain('URGENCY');
    expect(a.floor).toBe(0);
  });

  it('a requester name claiming a bank with a personal handle → UPI_NAME_MISMATCH', async () => {
    const r = await analyze({
      kind: 'collect_request',
      lang: 'en',
      collect: {
        ...base,
        contactedFirst: 'them',
        knowRequester: 'no',
        requesterName: 'SBI Refund Desk',
        requesterUpi: 'sbi.refund.desk@ybl',
        amount: 2000,
      },
    });
    expect(ids(r)).toContain('UPI_NAME_MISMATCH');
    expect(
      r.claimVsReality.some((c) => c.claim === 'Requester calls itself "SBI Refund Desk"'),
    ).toBe(true);
  });

  it('adds emergency and 1930 when the note says money is already gone', async () => {
    const r = await analyze({
      kind: 'collect_request',
      lang: 'en',
      collect: {
        ...base,
        toldYouWillReceive: true,
        contactedFirst: 'them',
        knowRequester: 'no',
        note: 'I already paid Rs 2,000 and they want more',
      },
    });
    expect(r.actions.slice(0, 2)).toEqual(['emergency', 'report_1930']);
  });

  it('a known requester splitting a bill shows no warning signs', async () => {
    const r = await analyze({
      kind: 'collect_request',
      lang: 'en',
      collect: {
        ...base,
        requesterName: 'Ravi',
        requesterUpi: 'ravi.k@okaxis',
        amount: 450,
        note: 'dinner split',
      },
    });
    expect(r.verdict).toBe('no_signs');
    expect(r.actions[0]).toBe('no_action_needed');
  });
});
