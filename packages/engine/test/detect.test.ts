import { normalizeText } from '@akshi/contracts';
import { describe, expect, it } from 'vitest';
import { countScripts, detectLang, hinglishHits, scriptsPresent } from '../src/detect/lang';
import { detectInputKind } from '../src/detect/kind';

const lang = (s: string) => detectLang(normalizeText(s));

describe('detectLang (§4.1)', () => {
  it('detects each Indic script at ≥ 70%', () => {
    expect(lang('आपका खाता आज बंद हो जाएगा')).toBe('hi');
    expect(lang('మీ ఖాతా ఈరోజు బ్లాక్ అవుతుంది')).toBe('te');
    expect(lang('আপনার অ্যাকাউন্ট আজই বন্ধ হয়ে যাবে')).toBe('bn');
  });

  it('keeps an Indic message with a few English words in its language', () => {
    expect(lang('आपका OTP 482913 है। OTP किसी को न बताएं।')).toBe('hi');
  });

  it('detects English, and Hinglish only with ≥ 3 marker hits', () => {
    expect(lang('Your account will be blocked today, update KYC now')).toBe('en');
    expect(lang('Aapka khata band ho jayega, turant KYC update karein')).toBe('hi');
    expect(lang('The band will play tonight')).toBe('en'); // one marker ("band") is not enough
    expect(hinglishHits('aapka khata band')).toBe(3);
  });

  it('returns mixed when two scripts each have ≥ 25%', () => {
    expect(lang('Your KYC is pending please update आपका केवाईसी लंबित है कृपया')).toBe('mixed');
  });

  it('returns other for no letters or other scripts', () => {
    expect(lang('482913 12:30 ₹500')).toBe('other');
    expect(lang('உங்கள் கணக்கு முடக்கப்படும்')).toBe('other'); // Tamil
  });

  it('reports which scripts are present', () => {
    expect([...scriptsPresent(countScripts('OTP బతావో ভাই और'))].sort()).toEqual([
      'beng',
      'deva',
      'latn',
      'telu',
    ]);
  });
});

describe('detectInputKind (§4.2)', () => {
  const cases: [string, ReturnType<typeof detectInputKind>['kind']][] = [
    ['upi://pay?pa=9876500001@ybl&pn=SBI%20Refund&am=4999', 'qr'],
    ['UPI://pay?pa=a1@ybl', 'qr'],
    ['kyc.update.helpdesk@ybl', 'upi_id'],
    ['9876500001@paytm', 'upi_id'],
    ['https://sbi-kyc-update.xyz/verify', 'url'],
    ['www.hdfcbenk.top', 'url'],
    ['sbi-kyc-update.xyz', 'url'],
    ['t.me/gharsekamai_tasks', 'url'],
    ['98765 00001', 'phone'],
    ['+91-98765-00001', 'phone'],
    ['1800 123 4567', 'phone'],
    ['[12/11/26, 10:02] Swift Courier: hello\n[12/11/26, 10:03] Rina: who is this?', 'chat'],
    ['12/11/2026, 10:02 - Ravi: hi\n12/11/2026, 10:03 - Me: hello', 'chat'],
    ['Ravi: hi\nMe: who?\nRavi: send otp\nMe: no', 'chat'],
    ['From: Income Tax <refunds@itd-refund.info>\nSubject: Refund approved\n\nVerify now', 'email'],
    ['Your SBI account will be blocked today, update KYC', 'message'],
    ['', 'message'],
  ];
  for (const [input, kind] of cases) {
    it(`${JSON.stringify(input.slice(0, 40))} → ${kind}`, () => {
      const r = detectInputKind(input);
      expect(r.kind).toBe(kind);
      expect(r.confidence).toBeGreaterThan(0);
      expect(r.confidence).toBeLessThanOrEqual(1);
    });
  }

  it('does not treat an email address or a decimal amount as a URL', () => {
    expect(detectInputKind('refunds@incometax.info').kind).not.toBe('url');
    expect(detectInputKind('2,499.00').kind).toBe('message');
  });
});
