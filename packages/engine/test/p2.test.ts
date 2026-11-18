/**
 * P2 engine helpers: live-listen phrase spotting, cloud vision client, community reports client.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ocrWithCloudVision } from '../src/browser';
import { communityReports, createLiveListener, reportToCommunity, setApiBase } from '../src/index';

afterEach(() => {
  vi.unstubAllGlobals();
  setApiBase('');
});

describe('live listen (M1.15)', () => {
  it('alerts once per call danger, the first time it is heard', () => {
    const l = createLiveListener('en');
    expect(l.push('hello madam this is from the', false).alerts).toEqual([]);
    expect(l.push('hello madam this is from the bank', true).alerts).toEqual([]);
    const otp = l.push('please tell me the OTP you received', false);
    expect(otp.alerts.map((a) => a.id)).toEqual(['ASKS_OTP']); // urgent asks alert on interim text
    expect(otp.alerts[0]?.label).toBe('Asks for your OTP');
    expect(l.push('please tell me the OTP you received', true).alerts).toEqual([]); // not repeated
    const call = l.push('do not disconnect the call', false);
    expect(call.alerts).toEqual([]); // non-urgent: waits for the final result
    const final = l.push('do not disconnect the call and do not tell anyone', true);
    expect(final.alerts.map((a) => a.id).sort()).toEqual(['SECRECY', 'STAY_ON_CALL']);
    expect(final.score.verdict).not.toBe('no_signs');
    expect(final.transcript).toContain('bank please tell me the OTP');
  });

  it('works in Hindi and resets', () => {
    const l = createLiveListener('hi');
    const u = l.push('आप डिजिटल अरेस्ट में हैं, कॉल मत काटना', true);
    expect(u.alerts.map((a) => a.id)).toEqual(
      expect.arrayContaining(['THREAT_LEGAL', 'STAY_ON_CALL']),
    );
    expect(u.alerts.find((a) => a.id === 'STAY_ON_CALL')?.label).toBe('कॉल पर रोके रखना');
    l.reset();
    expect(l.push('', true).transcript).toBe('');
  });
});

describe('cloud vision client (M2.3)', () => {
  it('posts a data URL and returns an OcrResult without boxes', async () => {
    setApiBase('http://api.test');
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => ({ width: 800, height: 600, close: vi.fn() })),
    );
    let sent: { imageBase64: string; lang: string } | null = null;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_u: string, init?: RequestInit) => {
        sent = JSON.parse(String(init?.body));
        return new Response(JSON.stringify({ text: 'Your  account\nwill be blocked' }));
      }),
    );
    const r = await ocrWithCloudVision(new Blob(['png-bytes'], { type: 'image/png' }), 'en');
    expect(sent!.imageBase64.startsWith('data:image/png;base64,')).toBe(true);
    expect(r).toEqual({
      text: 'Your account will be blocked',
      boxes: [],
      width: 800,
      height: 600,
      confidence: 75,
      langs: ['en'],
    });
  });

  it('returns null on failure', async () => {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => ({ width: 10, height: 10 })),
    );
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('x', { status: 503 })),
    );
    expect(await ocrWithCloudVision(new Blob(['x'], { type: 'image/png' }), 'en')).toBeNull();
  });
});

describe('community reports client (M8.6)', () => {
  it('maps a shown count to an IndicatorMatch and hides zero', async () => {
    setApiBase('http://api.test');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ reports: 4, category: 'fake_kyc' }))),
    );
    expect(await communityReports('upi', 'x@ybl')).toEqual({
      value: 'x@ybl',
      type: 'upi',
      reports: 4,
      category: 'fake_kyc',
      source: 'community',
      sampleData: false,
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ reports: 0 }))),
    );
    expect(await communityReports('upi', 'x@ybl')).toBeNull();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ ok: true, reports: 3 }))),
    );
    expect(await reportToCommunity('phone', '9876500001', 'other')).toBe(3);
  });

  it('returns null offline', async () => {
    expect(await communityReports('domain', 'x.com')).toBeNull();
  });
});
