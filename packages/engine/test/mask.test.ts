import { describe, expect, it } from 'vitest';
import { maskPII } from '../src/index';

const m = (s: string) => maskPII(s).masked;

describe('maskPII (§11)', () => {
  it('masks UPI IDs', () => {
    expect(m('Pay kyc.update.helpdesk@ybl or 9876500001@paytm')).toBe('Pay [UPI_ID] or [UPI_ID]');
  });

  it('masks emails (not as UPI IDs)', () => {
    expect(m('Write to itr.refund.cell@incometax-helpdesk.online now')).toBe(
      'Write to [EMAIL] now',
    );
  });

  it('masks Indian mobile and toll-free numbers', () => {
    expect(m('Call 98765 00001, +91-98765-00002, 9876500003 or 1800 123 4567')).toBe(
      'Call [PHONE], [PHONE], [PHONE] or [PHONE]',
    );
  });

  it('masks 12-digit Aadhaar-like groups and PAN numbers as ID numbers', () => {
    expect(m('Aadhaar 1234 5678 9012, also 123456789012, PAN ABCDE1234F')).toBe(
      'Aadhaar [ID_NUMBER], also [ID_NUMBER], PAN [ID_NUMBER]',
    );
  });

  it('masks 16-digit card numbers and 9–18 digit account numbers', () => {
    expect(m('Card 4111 1111 1111 1111 and 4111-1111-1111-1111, a/c 50100012345678')).toBe(
      'Card [NUMBER] and [NUMBER], a/c [NUMBER]',
    );
    expect(m('Ref 123456789')).toBe('Ref [NUMBER]');
  });

  it('keeps the registrable domain of URLs and drops the path and query', () => {
    expect(m('Open https://netbanking.sbi-kyc-update.xyz/verify?id=98765 now')).toBe(
      'Open https://sbi-kyc-update.xyz/[PATH] now',
    );
    expect(m('Visit www.hdfcbenk.top/login.')).toBe('Visit https://hdfcbenk.top/[PATH]');
  });

  it('masks names after salutations, not generic words', () => {
    expect(m('Dear Ravi, Mr. Sharma and Smt Lakshmi')).toBe(
      'Dear [NAME], Mr. [NAME] and Smt [NAME]',
    );
    expect(m('Dear Customer, Dear Sir')).toBe('Dear Customer, Dear Sir');
    expect(m('प्रिय राम, श्री मोहन जी')).toBe('प्रिय [NAME], श्री [NAME] जी');
    expect(m('प्रिय ग्राहक')).toBe('प्रिय ग्राहक');
  });

  it('keeps amounts and brand names', () => {
    const text =
      'SBI: ₹5,000 refund from HDFC Bank, Rs 1,00,000 or Rs.123456789 or INR 25000. Paytm, PhonePe and Amazon.';
    expect(m(text)).toBe(text);
  });

  it('counts replacements', () => {
    const r = maskPII(
      'Dear Ravi, pay kyc.update.helpdesk@ybl or call 98765 00001, mail a@b.com, see https://sbi-kyc-update.xyz/verify, acct 123456789012',
    );
    expect(r.masked).toBe(
      'Dear [NAME], pay [UPI_ID] or call [PHONE], mail [EMAIL], see https://sbi-kyc-update.xyz/[PATH] acct [ID_NUMBER]',
    );
    expect(r.replacements).toBe(6);
    expect(maskPII('nothing to hide').replacements).toBe(0);
  });

  it('leaves no phone, UPI ID, email or long digit run behind', () => {
    const r = m(
      'From sbi.refund.desk@ybl: call +91 98765 00001 or mail help@x.co, a/c 123456789012345, card 4111111111111111',
    );
    expect(r).not.toMatch(/@|\d{9,}|98765/);
  });
});
