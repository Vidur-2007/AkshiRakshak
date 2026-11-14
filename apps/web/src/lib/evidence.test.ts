import { describe, expect, it } from 'vitest';
import { analyze } from './engine';
import { blockableValues, buildEvidenceText, type EvidenceLabels } from './evidence';
import { buildRequest } from './scan';

const labels: EvidenceLabels = {
  heading: 'Evidence',
  date: 'Date',
  channel: 'Channel',
  verdict: 'Verdict',
  risk: 'Risk',
  category: 'Category',
  reasons: 'Reasons',
  links: 'Links',
  upi: 'UPI IDs',
  phones: 'Phones',
  emails: 'Emails',
  amounts: 'Amounts',
  message: 'Message',
};

const SMS =
  'Your SBI account will be BLOCKED today. Update KYC at http://sbi-kyc-update.xyz/verify or call 98765 00001. Pay to refund.desk@ybl';

describe('evidence', () => {
  it('lists details, verdict, reasons and the message', async () => {
    const result = await analyze(
      buildRequest(SMS, 'message', { lang: 'en', cloudAI: false, online: false, blocklist: [] }),
    );
    const text = buildEvidenceText({
      result,
      labels,
      verdictText: 'Scam',
      categoryName: 'Fake KYC',
      formatDate: () => 'DATE',
    });
    expect(text).toContain('Date: DATE');
    expect(text).toContain('Verdict: Scam');
    expect(text).toContain(`Risk: ${result.riskScore}/100`);
    expect(text).toContain('http://sbi-kyc-update.xyz/verify');
    expect(text).toContain('98765 00001');
    expect(text.endsWith(result.text)).toBe(true);
    expect(text).toMatch(/Reasons:\n- /);
  });

  it('offers UPI IDs, phones and non-official domains for the blocklist', async () => {
    const result = await analyze(
      buildRequest(SMS, 'message', { lang: 'en', cloudAI: false, online: false, blocklist: [] }),
    );
    const values = blockableValues(result);
    expect(values.map((v) => v.type).sort()).toEqual(
      expect.arrayContaining(['domain', 'phone', 'upi']),
    );
    expect(new Set(values.map((v) => v.value)).size).toBe(values.length);
  });
});

describe('buildRequest', () => {
  const o = { lang: 'hi' as const, cloudAI: true, online: false, blocklist: ['x@ybl'] };
  it('routes the value to the kind-specific field', () => {
    expect(buildRequest(' https://a.in ', 'url', o)).toMatchObject({
      kind: 'url',
      url: 'https://a.in',
    });
    expect(buildRequest('a@ybl', 'upi_id', o)).toMatchObject({ kind: 'upi_id', upiId: 'a@ybl' });
    expect(buildRequest('upi://pay?pa=a@ybl', 'qr', o)).toMatchObject({
      kind: 'qr',
      qrPayload: 'upi://pay?pa=a@ybl',
    });
    expect(buildRequest('hi', 'image', o).kind).toBe('message');
  });

  it('never asks for AI when offline and passes the blocklist', () => {
    const r = buildRequest('hello', 'message', o);
    expect(r.options).toMatchObject({ cloudAI: false, expandLinks: false, blocklist: ['x@ybl'] });
    expect(buildRequest('hello', 'message', { ...o, online: true }).options?.cloudAI).toBe(true);
  });

  it('caps huge input', () => {
    expect(buildRequest('a'.repeat(50_000), 'message', o).text).toHaveLength(20_000);
  });
});
