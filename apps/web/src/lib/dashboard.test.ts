import { describe, expect, it } from 'vitest';
import { byCategory, byDay, computeKpis, telHref } from './dashboard';
import { toScanRecord } from './db';
import { analyze } from './engine';

async function scan(text: string, kind: 'message' | 'qr' = 'message', createdAt?: string) {
  const r = await analyze(
    kind === 'qr' ? { kind, qrPayload: text, text, lang: 'en' } : { kind, text, lang: 'en' },
  );
  return toScanRecord(createdAt ? { ...r, createdAt } : r);
}

describe('dashboard', () => {
  it('counts scans, threats, money at risk (scam only) and links/QRs', async () => {
    const kyc = await scan(
      'Your SBI account will be BLOCKED today. Update KYC at http://sbi-kyc.xyz and pay Rs 5,000 now urgently',
    );
    const otp = await scan(
      '482913 is your OTP for Rs 2,499.00. Do not share your OTP with anyone.',
    );
    const qr = await scan('upi://pay?pa=refund.desk@ybl&am=4999', 'qr');
    const k = computeKpis([kyc, otp, qr]);
    expect(k.scans).toBe(3);
    expect(kyc.verdict).toBe('scam');
    expect(k.moneyAtRisk).toBe(kyc.result.entities.amounts.reduce((s, a) => s + a.value, 0));
    expect(k.linksAndQrs).toBe(
      kyc.result.entities.urls.length +
        otp.result.entities.urls.length +
        1 +
        qr.result.entities.urls.length,
    );
    expect(k.threats).toBe([kyc, otp, qr].filter((s) => s.verdict !== 'no_signs').length);
  });

  it('groups by category and by day', async () => {
    const a = await scan(
      'Your account will be BLOCKED today, update KYC now',
      'message',
      new Date(2026, 10, 14, 10).toISOString(),
    );
    const days = byDay([a], 3, new Date(2026, 10, 14, 23));
    expect(days).toHaveLength(3);
    expect(days[2]).toMatchObject({ day: '2026-11-14', scans: 1 });
    expect(byCategory([a]).reduce((s, c) => s + c.count, 0)).toBe(a.verdict === 'no_signs' ? 0 : 1);
  });

  it('makes tel: links only from phone-like input', () => {
    expect(telHref('+91 98765-00000')).toBe('tel:+919876500000');
    expect(telHref('9876500000')).toBe('tel:9876500000');
    expect(telHref('call me')).toBeNull();
    expect(telHref('12')).toBeNull();
  });
});
