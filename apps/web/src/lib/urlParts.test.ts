import { describe, expect, it } from 'vitest';
import { guessRegistrable, lookalikeRows, parseUrl } from './urlParts';

describe('parseUrl', () => {
  it('splits scheme, subdomain, domain, path and query', () => {
    const p = parseUrl('http://secure.sbi-kyc-update.xyz/verify?id=1#x')!;
    expect(p).toMatchObject({
      scheme: 'http',
      subdomain: 'secure',
      domain: 'sbi-kyc-update.xyz',
      path: '/verify',
      query: '?id=1',
      hash: '#x',
    });
  });

  it('handles Indian second-level domains and bare hosts', () => {
    expect(parseUrl('https://www.onlinesbi.sbi.co.in/login')!).toMatchObject({
      subdomain: 'www.onlinesbi',
      domain: 'sbi.co.in',
    });
    expect(parseUrl('netbanking.hdfcbank.bank.in')!).toMatchObject({
      scheme: 'http',
      subdomain: 'netbanking',
      domain: 'hdfcbank.bank.in',
      path: '',
    });
  });

  it('trusts the engine domain only when it really is a suffix of the host', () => {
    expect(parseUrl('https://a.b.example.com', 'b.example.com')!.domain).toBe('b.example.com');
    expect(parseUrl('https://xn--sb-oja.co.in/login', 'co.in/login')!.domain).toBe(
      'xn--sb-oja.co.in',
    );
    // browsers reject broken punycode; some Node versions accept it, so follow the platform's own URL parser
    let platformRejects = false;
    try {
      new URL('https://xn--invalid-.co.in/login');
    } catch {
      platformRejects = true;
    }
    if (platformRejects) expect(parseUrl('https://xn--invalid-.co.in/login')).toBeNull();
  });

  it('flags IPs, punycode and userinfo tricks', () => {
    expect(parseUrl('http://192.168.10.5:8080/pay')!).toMatchObject({
      isIp: true,
      domain: '192.168.10.5',
      port: '8080',
    });
    expect(parseUrl('https://sbí.co.in')!).toMatchObject({
      isPunycode: true,
      host: 'xn--sb-oja.co.in',
    });
    expect(parseUrl('https://www.sbi.co.in@evil.xyz/login')!).toMatchObject({
      userinfo: 'www.sbi.co.in@',
      domain: 'evil.xyz',
    });
  });

  it('returns null for things that are not URLs', () => {
    expect(parseUrl('')).toBeNull();
    expect(parseUrl('http://')).toBeNull();
  });

  it('guesses registrable domains', () => {
    expect(guessRegistrable('a.b.c.gov.in')).toBe('c.gov.in');
    expect(guessRegistrable('bit.ly')).toBe('bit.ly');
    expect(guessRegistrable('x.y.com')).toBe('y.com');
  });
});

describe('lookalikeRows', () => {
  it('marks the engine diff positions', () => {
    const r = lookalikeRows('sbi.co.in', 'sbl.co.in', [{ index: 2, expected: 'i', actual: 'l' }]);
    expect(r.actual.filter((c) => c.diff).map((c) => c.char)).toEqual(['l']);
    expect(r.official[2]).toEqual({ char: 'i', diff: true });
  });

  it('falls back to a character comparison', () => {
    const r = lookalikeRows('paytm.com', 'paytrn.com');
    expect(r.actual.some((c) => c.diff)).toBe(true);
    expect(r.actual.map((c) => c.char).join('')).toBe('paytrn.com');
  });
});
