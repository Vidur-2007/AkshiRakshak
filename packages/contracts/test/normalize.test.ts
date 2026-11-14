import { describe, expect, it } from 'vitest';
import { normalizeText } from '../src/index';

describe('normalizeText (SPEC.md §7.1)', () => {
  it('maps Devanagari digits to ASCII', () => {
    expect(normalizeText('०१२३४५६७८९')).toBe('0123456789');
    expect(normalizeText('₹५,०००')).toBe('₹5,000');
  });

  it('maps Bengali digits to ASCII', () => {
    expect(normalizeText('০১২৩৪৫৬৭৮৯')).toBe('0123456789');
  });

  it('maps Telugu digits to ASCII', () => {
    expect(normalizeText('౦౧౨౩౪౫౬౭౮౯')).toBe('0123456789');
  });

  it('removes zero-width characters (U+200B, U+200C, U+200D, U+2060, U+FEFF)', () => {
    expect(normalizeText('O\u200BT\u200CP\u200D \u2060cod\uFEFFe')).toBe('OTP code');
    expect(normalizeText('\uFEFFhello')).toBe('hello');
  });

  it('collapses whitespace runs to one space and trims', () => {
    expect(normalizeText('  your \n\n account\t\tis   blocked  ')).toBe('your account is blocked');
    expect(normalizeText('a\u00A0\u00A0b')).toBe('a b'); // NBSP
    expect(normalizeText('a\r\nb\u2003c')).toBe('a b c'); // CRLF, em space
    expect(normalizeText('   ')).toBe('');
  });

  it('applies NFKC', () => {
    expect(normalizeText('ＫＹＣ ＯＴＰ')).toBe('KYC OTP'); // full-width Latin
    expect(normalizeText('ﬁle')).toBe('file'); // ligature
    expect(normalizeText('１２３')).toBe('123'); // full-width digits
    expect(normalizeText('e\u0301')).toBe('é'); // composition
  });

  it('runs NFKC before digit mapping and whitespace collapse', () => {
    expect(normalizeText('OTP\u3000:\u3000４५౬')).toBe('OTP : 456'); // ideographic space, mixed digits
  });

  it('is idempotent', () => {
    const s = normalizeText(' आपका  खाता\u200D ब्लॉक ২৪ ঘণ্টায় ');
    expect(normalizeText(s)).toBe(s);
  });

  it('leaves Indic letters intact', () => {
    expect(normalizeText('మీ ఖాతా')).toBe('మీ ఖాతా');
  });
});
