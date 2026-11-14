/**
 * Network extras with a mocked fetch. No test here reaches the network.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { analyze, inspectUrl, setApiBase } from '../src/index';
import { inspectUrlLocal, inspectUrlNetwork } from '../src/links/inspect';

type Handler = (url: string) => unknown | Promise<unknown>;

function mockFetch(handler: Handler) {
  const fn = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const body = await handler(url);
    if (init?.signal?.aborted) throw new DOMException('aborted', 'AbortError');
    if (body === undefined) return new Response('{}', { status: 503 });
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

beforeEach(() => setApiBase('http://api.test'));
afterEach(() => {
  vi.unstubAllGlobals();
  setApiBase('');
});

describe('inspectUrl network extras', () => {
  it('expands a shortener and inspects the final URL once', async () => {
    const fetch = mockFetch((url) => {
      if (url.includes('/api/expand')) {
        return {
          hops: [
            { url: 'https://bit.ly/3abc', status: 301 },
            { url: 'https://sbi-kyc-update.xyz/verify', status: 200 },
          ],
          finalUrl: 'https://sbi-kyc-update.xyz/verify',
          truncated: false,
        };
      }
      return { domain: 'bit.ly', registered: '2008-01-01T00:00:00Z', ageDays: 6500 };
    });
    const u = await inspectUrl('https://bit.ly/3abc');
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('http://api.test/api/expand?url='),
      expect.anything(),
    );
    expect(u.expanded?.finalUrl).toBe('https://sbi-kyc-update.xyz/verify');
    expect(u.flags).toEqual(
      expect.arrayContaining(['SHORTENED_URL', 'LOOKALIKE_DOMAIN', 'REDIRECT_CHAIN']),
    );
    expect(u.lookalikeOf).toBe('sbi.bank.in');
    expect(u.risk).toBeGreaterThan(60);
  });

  it('adds NEW_DOMAIN from RDAP age, weighted 0.45 under 30 days', async () => {
    mockFetch((url) =>
      url.includes('/api/domain-age')
        ? { domain: 'fresh-offers.shop', registered: '2026-11-08T00:00:00Z', ageDays: 6 }
        : {
            hops: [{ url: 'https://fresh-offers.shop', status: 200 }],
            finalUrl: 'https://fresh-offers.shop',
            truncated: false,
          },
    );
    const u = await inspectUrl('https://fresh-offers.shop');
    expect(u.domainAge?.ageDays).toBe(6);
    expect(u.flags).toContain('NEW_DOMAIN');
    expect(u.risk).toBe(45);
  });

  it('skips network calls for official domains and when disabled', async () => {
    const fetch = mockFetch(() => undefined);
    await inspectUrl('https://www.sbi.co.in');
    await inspectUrl('https://unknown.example', { expand: false, domainAge: false });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('falls back silently on errors and bad payloads', async () => {
    mockFetch((url) =>
      url.includes('expand') ? { not: 'a chain' } : Promise.reject(new Error('offline')),
    );
    const u = await inspectUrl('https://unknown-site.example/x');
    expect(u.expanded).toBeUndefined();
    expect(u.domainAge).toBeUndefined();
    expect(u.registrableDomain).toBe('unknown-site.example');
  });

  it('never waits past the budget', async () => {
    mockFetch(() => new Promise(() => {})); // never resolves
    const local = inspectUrlLocal('https://slow-site.example');
    const t0 = Date.now();
    const { used } = await inspectUrlNetwork(local, { budgetMs: 150 });
    expect(Date.now() - t0).toBeLessThan(1000);
    expect(used).toBe(false);
  }, 3000);

  it('does nothing when the browser reports offline', async () => {
    const fetch = mockFetch(() => undefined);
    vi.stubGlobal('navigator', { onLine: false });
    const { used } = await inspectUrlNetwork(inspectUrlLocal('https://bit.ly/x'));
    expect(used).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('analyze() with network extras', () => {
  it('marks the result online and uses the expanded URL', async () => {
    mockFetch((url) =>
      url.includes('/api/expand')
        ? {
            hops: [
              { url: 'https://bit.ly/kyc', status: 301 },
              { url: 'https://hdfcbenk.top/login', status: 200 },
            ],
            finalUrl: 'https://hdfcbenk.top/login',
            truncated: false,
          }
        : { domain: 'bit.ly', ageDays: 5000 },
    );
    const r = await analyze({
      kind: 'url',
      url: 'https://bit.ly/kyc',
      lang: 'en',
      options: { layers: { indicators: false } },
    });
    expect(r.offline).toBe(false);
    expect(r.entities.urls[0]?.lookalikeOf).toBe('hdfcbank.com');
    expect(r.signals.map((s) => s.id)).toContain('LOOKALIKE_DOMAIN');
  });

  it('stays offline and fast when the API is unreachable', async () => {
    mockFetch(() => Promise.reject(new TypeError('fetch failed')));
    const r = await analyze({
      kind: 'message',
      text: 'Update KYC at http://sbi-kyc-update.xyz now',
      lang: 'en',
    });
    expect(r.offline).toBe(true);
    expect(r.verdict).not.toBe('no_signs');
  });
});
