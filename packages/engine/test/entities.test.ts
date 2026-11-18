import { normalizeText, type Entities, type Span } from '@akshi/contracts';
import { describe, expect, it } from 'vitest';
import { extractEntities } from '../src/extract/entities';
import { inspectUrlLocal } from '../src/links/inspect';

function extract(raw: string): { text: string; e: Entities } {
  const text = normalizeText(raw);
  return { text, e: extractEntities(text) };
}

function expectSpan(text: string, span: Span | undefined) {
  expect(span).toBeDefined();
  expect(text.slice(span!.start, span!.end)).toBe(span!.text);
}

describe('URLs', () => {
  it('finds scheme, www and bare-domain URLs and strips trailing punctuation', () => {
    const { text, e } = extract(
      'Visit http://sbi-kyc-update.xyz/verify. Or www.hdfcbenk.top, or t.me/earn_tasks!',
    );
    expect(e.urls.map((u) => u.raw)).toEqual([
      'http://sbi-kyc-update.xyz/verify',
      'www.hdfcbenk.top',
      't.me/earn_tasks',
    ]);
    e.urls.forEach((u) => expectSpan(text, u.span));
    expect(e.urls[0]).toMatchObject({
      host: 'sbi-kyc-update.xyz',
      registrableDomain: 'sbi-kyc-update.xyz',
      tld: 'xyz',
    });
  });

  it('uses the public suffix list for registrable domains', () => {
    expect(inspectUrlLocal('https://netbanking.sbi.co.in/login')).toMatchObject({
      registrableDomain: 'sbi.co.in',
      tld: 'co.in',
    });
    expect(inspectUrlLocal('https://www.hdfc.bank.in')).toMatchObject({
      registrableDomain: 'hdfc.bank.in',
      tld: 'bank.in',
    });
  });

  it('ignores decimals, amounts, abbreviations and file names', () => {
    const { e } = extract('Pay Rs.2,499.00 i.e. 12.5% by 9.30 a.m. Open Refund_Form.html');
    expect(e.urls).toEqual([]);
  });

  it('does not take an email domain as a URL', () => {
    const { e } = extract('Write to refunds@incometax-refund-portal.info today');
    expect(e.urls).toEqual([]);
    expect(e.emails).toEqual(['refunds@incometax-refund-portal.info']);
  });

  it('flags shorteners, raw IPs, risky TLDs, punycode and APK paths locally', () => {
    expect(inspectUrlLocal('https://bit.ly/3abc').flags).toContain('SHORTENED_URL');
    expect(inspectUrlLocal('http://192.168.10.5/kyc').flags).toContain('IP_URL');
    expect(inspectUrlLocal('http://2130706433/x').flags).toContain('IP_URL'); // decimal IP host
    expect(inspectUrlLocal('http://sbi-kyc.xyz').flags).toContain('RISKY_TLD');
    expect(inspectUrlLocal('http://xn--sbi-bnk-xyz.com').flags).toContain('PUNYCODE');
    const apk = inspectUrlLocal('http://bit.ly/Wedding_Card.apk');
    expect(apk.isApk).toBe(true);
    expect(apk.risk).toBeGreaterThan(50);
    expect(inspectUrlLocal('https://www.amazon.in/orders').risk).toBe(0);
  });
});

describe('UPI IDs', () => {
  it('finds UPI IDs but not emails', () => {
    const { text, e } = extract(
      'Pay kyc.update.helpdesk@ybl or 9876500001@paytm, mail help@sbi.co.in',
    );
    expect(e.upiIds.map((u) => u.raw)).toEqual(['kyc.update.helpdesk@ybl', '9876500001@paytm']);
    e.upiIds.forEach((u) => expectSpan(text, u.span));
    expect(e.emails).toEqual(['help@sbi.co.in']);
    expect(e.upiIds[0]).toMatchObject({
      handle: 'ybl',
      psp: 'PhonePe',
      pspKnown: true,
      looksPersonal: true,
    });
  });

  it('finds the pa= UPI ID inside a upi:// link', () => {
    const { e } = extract('upi://pay?pa=9876500001@ybl&pn=SBI%20Refund&am=4999');
    expect(e.upiIds.map((u) => u.raw)).toEqual(['9876500001@ybl']);
  });

  it('marks merchant handles as not personal and unknown PSPs', () => {
    const { e } = extract('Pay paytmqr28100505010@paytm or ravi@weirdpsp');
    expect(e.upiIds[0]?.looksPersonal).toBe(false);
    expect(e.upiIds[1]).toMatchObject({ pspKnown: false, psp: 'unknown' });
  });
});

describe('phones', () => {
  it('finds Indian mobiles with E.164 and toll-free numbers', () => {
    const { text, e } = extract(
      'Call 98765 00001 or +91-98765-00002 or 9876500003 or 1800 123 4567',
    );
    expect(e.phones.map((p) => p.e164)).toEqual([
      '+919876500001',
      '+919876500002',
      '+919876500003',
      undefined,
    ]);
    e.phones.forEach((p) => expectSpan(text, p.span));
  });

  it('does not match OTPs, account numbers or UPI IDs', () => {
    const { e } = extract('OTP 482913. A/c 123456789012. Pay 9876500001@ybl');
    expect(e.phones).toEqual([]);
  });

  it('sets claimedAs from nearby words in four languages', () => {
    expect(extract('Call our customer care 98765 00001').e.phones[0]?.claimedAs).toBe(
      'customer_care',
    );
    expect(extract('Inspector Sharma, Mumbai police: 98765 00001').e.phones[0]?.claimedAs).toBe(
      'police',
    );
    expect(extract('Your parcel is held, call 98765 00001').e.phones[0]?.claimedAs).toBe('courier');
    expect(extract('बैंक मैनेजर से बात करें 98765 00001').e.phones[0]?.claimedAs).toBe('bank');
    expect(extract('కస్టమర్ కేర్ 98765 00001 కు కాల్ చేయండి').e.phones[0]?.claimedAs).toBe('customer_care');
    expect(extract('পুলিশ অফিসার 98765 00001').e.phones[0]?.claimedAs).toBe('police');
    expect(extract('Hi, save my number 98765 00001').e.phones[0]?.claimedAs).toBe('unknown');
  });
});

describe('amounts', () => {
  const values = (raw: string) => extract(raw).e.amounts.map((a) => a.value);

  it('parses ₹, Rs, INR, rupees and /- with Indian grouping', () => {
    expect(values('Pay ₹5,000 or Rs. 1,00,000.50 or INR 750 or 2500 rupees or 999/-')).toEqual([
      5000, 100000.5, 750, 2500, 999,
    ]);
  });

  it('parses k, lakh and crore', () => {
    expect(values('Win ₹25 lakh, Rs 1.5 crore or ₹10k. 2 lakh loan')).toEqual([
      2500000, 15000000, 10000, 200000,
    ]);
  });

  it('parses amounts in Hindi, Telugu and Bengali, including native digits', () => {
    expect(values('₹५,००० रुपये नहीं, 2 लाख रुपये')).toEqual([5000, 200000]);
    expect(values('రూ.5,000 లేదా 3 లక్షలు')).toEqual([5000, 300000]);
    expect(values('৫০০ টাকা এবং 2 লাখ টাকা')).toEqual([500, 200000]);
  });

  it('gives every amount a valid span', () => {
    const { text, e } = extract('Pay ₹5,000 and Rs 2,499.00 today');
    e.amounts.forEach((a) => expectSpan(text, a.span));
  });

  it('does not read phone numbers or plain numbers as amounts', () => {
    expect(values('Call 98765 00001, order 4567, valid 10 minutes')).toEqual([]);
  });
});

describe('APK mentions', () => {
  it('finds .apk file names in URLs and words', () => {
    const { text, e } = extract('Install http://x.site/SBI_Rewards.apk or wedding_card.apk now');
    expect(e.apkMentions.map((s) => s.text)).toEqual([
      'http://x.site/SBI_Rewards.apk',
      'wedding_card.apk',
    ]);
    e.apkMentions.forEach((s) => expectSpan(text, s));
  });
});
