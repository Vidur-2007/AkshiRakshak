import { AnalysisResultSchema, normalizeText } from '@akshi/contracts';
import { ANALYSIS_FIXTURES } from '@akshi/contracts/fixtures';
import { describe, expect, it } from 'vitest';
import { analyzeChat, parseChat } from '../src/context/chat';
import { addressDomain, analyzeEmail, parseEmailHeaders } from '../src/context/email';
import { analyze as analyzeOnline } from '../src/index';

const analyze: typeof analyzeOnline = (req, cb) =>
  analyzeOnline(
    {
      ...req,
      options: {
        expandLinks: false,
        domainAge: false,
        layers: { indicators: false },
        ...req.options,
      },
    },
    cb,
  );
const ids = (r: { signals: { id: string }[] }) => r.signals.map((s) => s.id);
const LRM = String.fromCodePoint(0x200e);
const NNBSP = String.fromCodePoint(0x202f);

describe('chat parsing (§9)', () => {
  it('reads iOS exports, including seconds, AM/PM, LRM marks and multi-line messages', () => {
    const raw = [
      `${LRM}[12/11/26, 10:02:11${NNBSP}AM] Swift Courier: Hello, your parcel is held at customs.`,
      `[12/11/26, 10:03:40${NNBSP}AM] Rina: Which parcel?`,
      `[12/11/26, 10:05:02${NNBSP}AM] Swift Courier: Pay the customs fee today`,
      'or a police case will be filed.',
    ].join('\n');
    const text = normalizeText(raw);
    const turns = parseChat(raw, text);
    expect(turns.map((t) => `${t.sender}:${t.name}`)).toEqual([
      'them:Swift Courier',
      'me:Rina',
      'them:Swift Courier',
    ]);
    expect(turns[2]!.body).toBe('Pay the customs fee today or a police case will be filed.');
    for (const t of turns) expect(text.slice(t.start, t.end)).toBe(t.text);
  });

  it('reads Android exports and skips system lines', () => {
    const raw = [
      '12/11/2026, 09:59 - Messages and calls are end-to-end encrypted. No one outside of this chat can read them.',
      '12/11/2026, 10:02 pm - Ravi Kumar: hi',
      '12/11/2026, 10:03 pm - Me: who is this?',
      '12/11/2026, 10:04 pm - Ravi Kumar: send the otp',
    ].join('\n');
    const turns = parseChat(raw, normalizeText(raw));
    expect(turns.map((t) => t.sender)).toEqual(['unknown', 'them', 'me', 'them']);
  });

  it('reads "Name:" lines and falls back to one turn per line', () => {
    const named = 'Agent: Hello sir\nMe: Yes?\nAgent: Your KYC is pending\nMe: ok';
    expect(parseChat(named, normalizeText(named)).map((t) => t.sender)).toEqual([
      'them',
      'me',
      'them',
      'me',
    ]);
    const plain = 'hello\nyour account is blocked\nshare otp';
    const turns = parseChat(plain, normalizeText(plain));
    expect(turns).toHaveLength(3);
    expect(turns.every((t) => t.sender === 'unknown')).toBe(true);
  });

  it('treats the speaker who did not start the chat as "me" when no "You" is present', () => {
    const raw =
      '[12/11/26, 10:00] A: hi\n[12/11/26, 10:01] B: hello\n[12/11/26, 10:02] A: pay now\n[12/11/26, 10:03] B: no';
    expect(parseChat(raw, normalizeText(raw)).map((t) => t.sender)).toEqual([
      'them',
      'me',
      'them',
      'me',
    ]);
  });
});

describe('ESCALATION', () => {
  it('fires on rising risk across three "them" turns ending ≥ 60', () => {
    const raw = [
      '[12/11/26, 10:00] Agent: Hello sir',
      '[12/11/26, 10:01] Agent: Your account will be blocked today',
      '[12/11/26, 10:02] Agent: Your account will be blocked today, update KYC immediately',
      '[12/11/26, 10:03] Agent: Your SBI account will be blocked today. Share the OTP immediately to update KYC',
    ].join('\n');
    const c = analyzeChat(raw, normalizeText(raw), () => 0);
    expect(c.escalation).toBeNull(); // risks all 0 with the dummy scorer…
    const scores = [5, 25, 45, 75];
    let i = 0;
    const r = analyzeChat(raw, normalizeText(raw), () => scores[i++]!);
    expect(r.escalation).toMatchObject({ rule: 'rising_risk' });
    expect(r.escalation!.turns.length).toBeGreaterThanOrEqual(3);
  });

  it('fires on problem → link/app → OTP/PIN/payment', () => {
    const raw = [
      '[12/11/26, 10:00] Support: Hello madam',
      '[12/11/26, 10:01] Me: yes',
      '[12/11/26, 10:02] Support: Your refund was sent by mistake to another account',
      '[12/11/26, 10:03] Support: Please install AnyDesk so I can help',
      '[12/11/26, 10:04] Support: Now tell me the OTP you received',
    ].join('\n');
    const r = analyzeChat(raw, normalizeText(raw), () => 10);
    expect(r.escalation?.rule).toBe('sequence');
    expect(r.escalation?.turns).toEqual([0, 2, 3, 4]);
  });

  it('does not fire on an ordinary family chat', async () => {
    const raw =
      '[12/11/26, 19:00] Maa: Beta khana khaya?\n[12/11/26, 19:01] Me: haan maa\n[12/11/26, 19:02] Maa: Kal ghar aa jana, papa ka birthday hai';
    const r = await analyze({ kind: 'chat', text: raw, lang: 'hi' });
    expect(ids(r)).not.toContain('ESCALATION');
    expect(r.verdict).toBe('no_signs');
  });

  it('gives the contracts chat fixture a sensible real result', async () => {
    const fx = ANALYSIS_FIXTURES['analysis-chat'];
    // rebuild the export lines from the fixture turns
    const raw = (fx.chat ?? []).map((t) => t.text).join('\n');
    const r = AnalysisResultSchema.parse(await analyze({ kind: 'chat', text: raw, lang: 'bn' }));
    expect(r.verdict).toBe('scam');
    expect(r.category).toBe('courier_customs');
    expect(ids(r)).toEqual(
      expect.arrayContaining(['ESCALATION', 'ASKS_OTP', 'THREAT_LEGAL', 'SECRECY']),
    );
    expect(r.chat?.map((t) => t.sender)).toEqual(['them', 'me', 'them', 'them', 'me', 'them']);
    const esc = r.signals.find((s) => s.id === 'ESCALATION')!;
    for (const s of esc.spans) expect(r.text.slice(s.start, s.end)).toBe(s.text);
  });
});

describe('email analysis (§9)', () => {
  const FX = [
    'From: Income Tax Department <refunds@incometax-refund-portal.info>',
    'Reply-To: itr.refund.cell@incometax-helpdesk.online',
    'Subject: Income tax refund of Rs 18,450 approved',
    '',
    'Dear Taxpayer, your refund of Rs 18,450 is pending. Verify your bank account within 24 hours at https://incometax-refund-portal.info/claim or the refund will be cancelled.',
    'Attachment: Refund_Form.html',
  ].join('\n');

  it('parses headers, addresses and attachments', () => {
    const h = parseEmailHeaders(FX);
    expect(h).toMatchObject({
      from: 'Income Tax Department <refunds@incometax-refund-portal.info>',
      replyTo: 'itr.refund.cell@incometax-helpdesk.online',
    });
    expect(h.attachments).toEqual(['Refund_Form.html']);
    expect(addressDomain(h.from)).toBe('incometax-refund-portal.info');
    expect(
      parseEmailHeaders('See https://x.com/page.html or mail a@b.html.com').attachments,
    ).toEqual([]);
  });

  it('finds BRAND_MISMATCH by sender domain, REPLY_TO_MISMATCH and RISKY_ATTACHMENT', () => {
    const e = analyzeEmail(FX, normalizeText(FX), 'en');
    expect(e.signals.map((s) => s.id).sort()).toEqual([
      'BRAND_MISMATCH',
      'REPLY_TO_MISMATCH',
      'RISKY_ATTACHMENT',
    ]);
    expect(e.claims[0]).toMatchObject({
      claim: 'Says it is from Income Tax Department',
      reality: 'Sent from incometax-refund-portal.info, not incometax.gov.in',
    });
    expect(e.claims[1]).toMatchObject({
      claim: 'Sender: incometax-refund-portal.info',
      reality: 'Replies go to incometax-helpdesk.online',
    });
  });

  it('gives the contracts email fixture a sensible real result', async () => {
    const r = AnalysisResultSchema.parse(await analyze({ kind: 'email', text: FX, lang: 'en' }));
    expect(r.verdict).toBe('scam');
    expect(r.category).toBe('impersonation_govt');
    expect(ids(r)).toEqual(
      expect.arrayContaining([
        'BRAND_MISMATCH',
        'REPLY_TO_MISMATCH',
        'RISKY_ATTACHMENT',
        'LOOKALIKE_DOMAIN',
      ]),
    );
    expect(r.entities.brands.find((b) => b.brand === 'Income Tax Department')?.mismatch).toBe(true);
    expect(ANALYSIS_FIXTURES['analysis-email'].verdict).toBe(r.verdict);
  });

  it('flags a bank name sent from free webmail and a zip named like an invoice', async () => {
    const raw =
      'From: SBI Alerts <sbi.alerts.kyc@gmail.com>\nSubject: KYC update\n\nUpdate your KYC today. Attachment: KYC_invoice_2026.zip';
    const r = await analyze({ kind: 'email', text: raw, lang: 'en' });
    expect(ids(r)).toEqual(expect.arrayContaining(['BRAND_MISMATCH', 'RISKY_ATTACHMENT']));
    expect(r.verdict).not.toBe('no_signs');
  });

  it('shows no warning signs for a genuine order email from the brand domain', async () => {
    const raw =
      'From: Amazon.in <shipment-tracking@amazon.in>\nSubject: Your order has shipped\n\nYour Amazon order has been shipped. Track it at https://www.amazon.in/progress-tracker';
    const r = await analyze({ kind: 'email', text: raw, lang: 'en' });
    expect(r.verdict).toBe('no_signs');
    expect(ids(r)).not.toContain('BRAND_MISMATCH');
  });
});
