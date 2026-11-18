import { describe, expect, it } from 'vitest';
import { charDiff, findLookalike, homoglyphForms, osaDistance } from '../src/links/lookalike';
import { inspectUrlLocal, isOfficialFor, officialOwner } from '../src/links/inspect';
import { decodePunycode, toUnicodeHost } from '../src/links/punycode';
import { BRAND_BY_ID, BRANDS, RISKY_TLDS, SHORTENERS } from '../src/links/registry';

const CYR_A = String.fromCodePoint(0x0430);
const CYR_O = String.fromCodePoint(0x043e);

describe('registry (§6.1)', () => {
  it('has every brand listed in SPEC_A §6.1', () => {
    const names = BRANDS.map((b) => b.name).join(' | ');
    for (const n of [
      'SBI',
      'HDFC Bank',
      'ICICI Bank',
      'Axis Bank',
      'Kotak',
      'Punjab National Bank',
      'Bank of Baroda',
      'Canara Bank',
      'Union Bank of India',
      'IDFC FIRST',
      'Yes Bank',
      'IndusInd',
      'RBI',
      'NPCI',
      'BHIM',
      'Income Tax',
      'UIDAI',
      'India Post',
      'EPFO',
      'Parivahan',
      'Cyber Crime',
      'Sanchar Saathi',
      'TRAI',
      'Paytm',
      'PhonePe',
      'Google Pay',
      'Amazon',
      'Flipkart',
      'Blue Dart',
      'DTDC',
      'Delhivery',
      'FedEx',
      'Jio',
      'Airtel',
      'Vi',
    ]) {
      expect(names, n).toContain(n);
    }
  });

  it('gives every bank a .bank.in domain first and keeps legacy domains', () => {
    for (const b of BRANDS.filter((x) => x.kind === 'bank')) {
      expect(b.domains[0], b.name).toMatch(/\.bank\.in$/);
      expect(b.domains.length, b.name).toBeGreaterThan(1);
    }
  });

  it('stores domains and tokens in lower case', () => {
    for (const b of BRANDS) {
      for (const d of b.domains) expect(d).toBe(d.toLowerCase());
      for (const t of b.tokens) expect(t).toMatch(/^[a-z0-9]+$/);
    }
    for (const s of [...SHORTENERS, ...RISKY_TLDS]) expect(s).toBe(s.toLowerCase());
  });

  it('applies the bank.in and gov.in suffix rules by brand kind', () => {
    const sbi = BRAND_BY_ID.get('sbi')!;
    const itd = BRAND_BY_ID.get('incometax')!;
    expect(isOfficialFor(sbi, 'sbi.bank.in', 'bank.in')).toBe(true);
    expect(isOfficialFor(sbi, 'onlinesbi.sbi', 'sbi')).toBe(true); // brand TLD
    expect(isOfficialFor(sbi, 'anybank.bank.in', 'bank.in')).toBe(true); // any bank.in is a bank domain
    expect(isOfficialFor(itd, 'incometax.gov.in', 'gov.in')).toBe(true);
    expect(isOfficialFor(itd, 'sbi.bank.in', 'bank.in')).toBe(false);
    expect(isOfficialFor(sbi, 'incometax.gov.in', 'gov.in')).toBe(false);
    expect(officialOwner('somebank.bank.in', 'bank.in')).toBe('bank');
    expect(officialOwner('mca.gov.in', 'gov.in')).toBe('govt');
  });
});

describe('lookalike helpers', () => {
  it('computes Damerau-Levenshtein (OSA) distance', () => {
    expect(osaDistance('hdfcbank', 'hdfcbank')).toBe(0);
    expect(osaDistance('hdfcbenk', 'hdfcbank')).toBe(1);
    expect(osaDistance('hdfcbnak', 'hdfcbank')).toBe(1); // transposition
    expect(osaDistance('icicbank', 'icicibank')).toBe(1);
  });

  it('builds a character-level diff with host offsets', () => {
    expect(charDiff('hdfcbenk', 'hdfcbank')).toEqual([{ index: 5, expected: 'a', actual: 'e' }]);
    expect(charDiff('icicbank', 'icicibank', 4)).toEqual([{ index: 8, expected: 'i', actual: '' }]);
    expect(charDiff('sbii', 'sbi')).toEqual([{ index: 2, expected: '', actual: 'i' }]);
  });

  it('maps homoglyphs and look-alike sequences', () => {
    expect(homoglyphForms(`p${CYR_A}ytm`)).toContain('paytm');
    expect(homoglyphForms('paytrn')).toContain('paytm');
    expect(homoglyphForms('amaz0n')).toContain('amazon');
    expect(homoglyphForms('1cic1')).toContain('icici');
  });

  it('decodes punycode', () => {
    expect(decodePunycode('mnchen-3ya')).toBe('münchen');
    const host = new URL(`http://p${CYR_A}ytm.com`).hostname;
    expect(host.startsWith('xn--')).toBe(true);
    expect(toUnicodeHost(host)).toBe(`p${CYR_A}ytm.com`);
  });

  it('does not flag allowlisted or unrelated domains', () => {
    expect(findLookalike('amazonaws.com', 'amazonaws', 's3', 3)).toBeNull();
    expect(findLookalike('example.com', 'example', '', 0)).toBeNull();
    expect(findLookalike('train.com', 'train', '', 0)).toBeNull();
  });
});

describe('inspectUrlLocal (§6.2)', () => {
  it('flags a brand token in an unofficial domain (sbi-kyc-update.xyz)', () => {
    const u = inspectUrlLocal('http://sbi-kyc-update.xyz/verify');
    expect(u.flags).toEqual(
      expect.arrayContaining(['LOOKALIKE_DOMAIN', 'RISKY_TLD', 'SUSPICIOUS_LINK']),
    );
    expect(u.lookalikeOf).toBe('sbi.bank.in');
    expect(u.isOfficial).toBe(false);
  });

  it('flags a one-letter typo with a character diff', () => {
    const u = inspectUrlLocal('https://hdfcbenk.top/netbanking');
    expect(u.lookalikeOf).toBe('hdfcbank.com');
    expect(u.lookalikeDiff).toEqual([{ index: 5, expected: 'a', actual: 'e' }]);
  });

  it('flags the official label on another suffix and a brand in a subdomain', () => {
    expect(inspectUrlLocal('http://icicibank.xyz').flags).toContain('LOOKALIKE_DOMAIN');
    const sub = inspectUrlLocal('https://sbi.secure-login.top/kyc');
    expect(sub.flags).toContain('LOOKALIKE_DOMAIN');
    expect(sub.lookalikeOf).toBe('sbi.bank.in');
  });

  it('flags Cyrillic homoglyph domains as punycode lookalikes and shows them decoded', () => {
    const u = inspectUrlLocal(`https://p${CYR_A}ytm.com/login`);
    expect(u.host).toBe(`p${CYR_A}ytm.com`);
    expect(u.flags).toEqual(expect.arrayContaining(['PUNYCODE', 'LOOKALIKE_DOMAIN']));
    expect(u.lookalikeOf).toBe('paytm.com');
    expect(u.lookalikeDiff?.[0]).toMatchObject({ index: 1, expected: 'a', actual: CYR_A });
    expect(inspectUrlLocal(`http://g${CYR_O}${CYR_O}gle-pay.com`).flags).toContain('PUNYCODE');
  });

  it('flags rn→m and digit swaps', () => {
    expect(inspectUrlLocal('paytrn.com').lookalikeOf).toBe('paytm.com');
    expect(inspectUrlLocal('amaz0n-offers.in').flags).toContain('LOOKALIKE_DOMAIN');
  });

  it('recognises official domains, including .bank.in, brand TLDs and gov.in, with risk capped at 10', () => {
    for (const url of [
      'https://netbanking.hdfc.bank.in',
      'https://www.onlinesbi.sbi',
      'https://www.incometax.gov.in',
      'https://www.amazon.in/orders',
      'https://www.bluedart.com/tracking',
    ]) {
      const u = inspectUrlLocal(url);
      expect(u.isOfficial, url).toBe(true);
      expect(u.flags, url).not.toContain('LOOKALIKE_DOMAIN');
      expect(u.risk, url).toBeLessThanOrEqual(10);
    }
  });

  it('judges officialness against the claimed brand when given', () => {
    const sbi = BRAND_BY_ID.get('sbi')!;
    expect(inspectUrlLocal('https://www.amazon.in', undefined, { claimed: [sbi] }).isOfficial).toBe(
      false,
    );
    expect(inspectUrlLocal('https://sbi.bank.in', undefined, { claimed: [sbi] }).isOfficial).toBe(
      true,
    );
  });

  it('flags shorteners, raw IPs, APKs and plain-http login pages', () => {
    expect(inspectUrlLocal('https://bit.ly/3xyz')).toMatchObject({ isShortener: true });
    expect(inspectUrlLocal('http://103.21.58.10/sbi/login').flags).toEqual(
      expect.arrayContaining(['IP_URL', 'SUSPICIOUS_LINK']),
    );
    expect(inspectUrlLocal('http://cdn-files.site/SBI_Rewards.apk')).toMatchObject({ isApk: true });
    expect(inspectUrlLocal('https://example.org/login').flags).not.toContain('SUSPICIOUS_LINK'); // https
  });

  it('computes risk as the noisy-OR of flag weights', () => {
    const u = inspectUrlLocal('http://sbi-kyc-update.xyz/verify');
    // LOOKALIKE 0.55, RISKY_TLD 0.15, SUSPICIOUS_LINK 0.20 → 1 − 0.45×0.85×0.80 = 0.694
    expect(u.risk).toBe(69);
  });
});
