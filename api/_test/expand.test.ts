/**
 * SSRF guard and redirect expansion with fake DNS and fake fetch — no network.
 */
import { RedirectChainSchema } from '@akshi/contracts';
import { describe, expect, it, vi } from 'vitest';
import {
  assertPublicHost,
  checkTarget,
  expandIPv6,
  expandUrl,
  isPrivateAddress,
  SsrfError,
  type HopFetch,
  type LookupFn,
} from '../_lib/ssrf.js';
import { GET } from '../expand.js';

const publicDns: LookupFn = async () => [{ address: '93.184.216.34', family: 4 }];
const dnsMap =
  (m: Record<string, string[]>): LookupFn =>
  async (h) => {
    const a = m[h];
    if (!a) throw new Error('ENOTFOUND');
    return a.map((address) => ({ address, family: address.includes(':') ? 6 : 4 }));
  };

describe('private and reserved addresses', () => {
  it('blocks IPv4 private, loopback, link-local, CGNAT, benchmark, multicast and reserved ranges', () => {
    for (const ip of [
      '0.0.0.0',
      '10.1.2.3',
      '100.64.0.1',
      '127.0.0.1',
      '169.254.169.254',
      '172.16.0.1',
      '172.31.255.255',
      '192.168.1.1',
      '198.18.0.1',
      '224.0.0.1',
      '240.0.0.1',
      '255.255.255.255',
    ]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
    for (const ip of ['8.8.8.8', '93.184.216.34', '172.32.0.1', '100.128.0.1'])
      expect(isPrivateAddress(ip), ip).toBe(false);
  });

  it('blocks IPv6 loopback, unspecified, ULA, link-local, multicast and IPv4-mapped private', () => {
    for (const ip of [
      '::1',
      '::',
      'fc00::1',
      'fd12:3456::1',
      'fe80::1',
      'ff02::1',
      '::ffff:127.0.0.1',
      '::ffff:7f00:1',
      '::ffff:10.0.0.1',
      '64:ff9b::a00:1',
      '2001:db8::1',
      '[::1]',
    ]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
    for (const ip of ['2606:4700:4700::1111', '::ffff:8.8.8.8', '2001:4860:4860::8888'])
      expect(isPrivateAddress(ip), ip).toBe(false);
    expect(expandIPv6('::ffff:127.0.0.1')).toEqual([0, 0, 0, 0, 0, 0xffff, 0x7f00, 1]);
  });

  it('treats decimal, octal and hex IPv4 hosts as the IPs they are', async () => {
    for (const raw of [
      'http://2130706433/',
      'http://0177.0.0.1/',
      'http://0x7f000001/',
      'http://127.1/',
    ]) {
      const u = checkTarget(raw);
      expect(u.hostname, raw).toBe('127.0.0.1');
      await expect(assertPublicHost(u.hostname, publicDns), raw).rejects.toThrow(SsrfError);
    }
  });

  it('refuses a hostname when any resolved address is private', async () => {
    await expect(
      assertPublicHost('evil.example', dnsMap({ 'evil.example': ['93.184.216.34', '10.0.0.5'] })),
    ).rejects.toMatchObject({ code: 'private_address' });
    await expect(
      assertPublicHost('v6.example', dnsMap({ 'v6.example': ['::1'] })),
    ).rejects.toMatchObject({ code: 'private_address' });
    await expect(assertPublicHost('nx.example', dnsMap({}))).rejects.toMatchObject({
      code: 'dns_failed',
    });
    await expect(assertPublicHost('ok.example', publicDns)).resolves.toBeUndefined();
  });
});

describe('URL checks', () => {
  it('allows only http/https on ports 80/443, without credentials, up to 2,048 chars', () => {
    expect(() => checkTarget('ftp://x.com/')).toThrow(/bad_scheme/);
    expect(() => checkTarget('file:///etc/passwd')).toThrow(/bad_scheme/);
    expect(() => checkTarget('http://x.com:8080/')).toThrow(/bad_port/);
    expect(() => checkTarget('http://user:pw@x.com/')).toThrow(/credentials/);
    expect(() => checkTarget(`https://x.com/${'a'.repeat(2050)}`)).toThrow(/too_long/);
    expect(checkTarget('https://x.com:443/a').href).toBe('https://x.com/a');
  });
});

describe('expandUrl', () => {
  const chainFetch = (
    m: Record<string, { status: number; location?: string; head?: number }>,
  ): HopFetch =>
    vi.fn(async (url: string, method: 'HEAD' | 'GET') => {
      const r = m[url];
      if (!r) throw new Error('unreachable');
      if (method === 'HEAD' && r.head) return { status: r.head, location: null };
      return { status: r.status, location: r.location ?? null };
    });

  it('follows redirects manually and returns hops and the final URL only', async () => {
    const fetch = chainFetch({
      'https://bit.ly/abc': { status: 301, location: 'https://t.co/x' },
      'https://t.co/x': { status: 302, location: '/landing?a=1' },
      'https://t.co/landing?a=1': { status: 200 },
    });
    const chain = RedirectChainSchema.parse(
      await expandUrl('https://bit.ly/abc', { fetch, lookup: publicDns }),
    );
    expect(chain).toEqual({
      hops: [
        { url: 'https://bit.ly/abc', status: 301 },
        { url: 'https://t.co/x', status: 302 },
        { url: 'https://t.co/landing?a=1', status: 200 },
      ],
      finalUrl: 'https://t.co/landing?a=1',
      truncated: false,
    });
  });

  it('refuses a redirect to a private address and stops there', async () => {
    const fetch = chainFetch({
      'https://short.example/a': {
        status: 302,
        location: 'http://169.254.169.254/latest/meta-data',
      },
    });
    const chain = await expandUrl('https://short.example/a', { fetch, lookup: publicDns });
    expect(chain.error).toBe('blocked_private_address');
    expect(chain.hops).toEqual([{ url: 'https://short.example/a', status: 302 }]);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('refuses a redirect to a hostname that resolves to a private address, and to other ports', async () => {
    const lookup = dnsMap({
      'short.example': ['93.184.216.34'],
      'internal.example': ['192.168.0.10'],
    });
    const toInternal = chainFetch({
      'https://short.example/a': { status: 301, location: 'https://internal.example/' },
    });
    expect((await expandUrl('https://short.example/a', { fetch: toInternal, lookup })).error).toBe(
      'blocked_private_address',
    );
    const toPort = chainFetch({
      'https://short.example/a': { status: 301, location: 'http://short.example:8080/' },
    });
    expect((await expandUrl('https://short.example/a', { fetch: toPort, lookup })).error).toBe(
      'bad_port',
    );
  });

  it('stops after 5 hops and marks the chain truncated', async () => {
    const m: Record<string, { status: number; location: string }> = {};
    for (let i = 0; i < 10; i++)
      m[`https://loop.example/${i}`] = { status: 302, location: `https://loop.example/${i + 1}` };
    const chain = await expandUrl('https://loop.example/0', {
      fetch: chainFetch(m),
      lookup: publicDns,
    });
    expect(chain.hops).toHaveLength(5);
    expect(chain.truncated).toBe(true);
  });

  it('falls back to GET when HEAD is rejected', async () => {
    const fetch = chainFetch({ 'https://nohead.example/': { status: 200, head: 405 } });
    const chain = await expandUrl('https://nohead.example/', { fetch, lookup: publicDns });
    expect(chain.hops).toEqual([{ url: 'https://nohead.example/', status: 200 }]);
    expect(fetch).toHaveBeenCalledWith('https://nohead.example/', 'GET', expect.anything());
  });

  it('reports an unreachable first hop without throwing', async () => {
    const chain = await expandUrl('https://down.example/', {
      fetch: chainFetch({}),
      lookup: publicDns,
    });
    expect(chain).toMatchObject({
      hops: [],
      finalUrl: 'https://down.example/',
      error: 'unreachable',
    });
  });
});

describe('GET /api/expand', () => {
  it('rejects missing, private-scheme and non-standard-port URLs with 400', async () => {
    for (const q of ['', 'ftp%3A%2F%2Fx.com', 'http%3A%2F%2Fx.com%3A8080%2F']) {
      const res = await GET(
        new Request(`http://localhost/api/expand?url=${q}`, {
          headers: { 'x-forwarded-for': '3.3.3.3' },
        }),
      );
      expect(res.status, q).toBe(400);
    }
  });

  it('refuses a literal private IP target (no network involved)', async () => {
    const res = await GET(
      new Request('http://localhost/api/expand?url=http%3A%2F%2F2130706433%2F', {
        headers: { 'x-forwarded-for': '4.4.4.4' },
      }),
    );
    expect(res.status).toBe(200);
    const chain = RedirectChainSchema.parse(await res.json());
    expect(chain.error).toBe('blocked_private_address');
    expect(chain.hops).toEqual([]);
  });
});
