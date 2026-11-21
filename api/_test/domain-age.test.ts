/**
 * RDAP domain age, health and the rate limiter — fake fetch, no network.
 */
import { DomainAgeSchema, HealthResponseSchema } from '@akshi/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { lookupDomainAge, registrableDomain } from '../_lib/rdap.js';
import { checkRate, LIMITS, resetRateLimits } from '../_lib/ratelimit.js';
import { GET as domainAge } from '../domain-age.js';
import { GET as health } from '../health.js';

const NOW = Date.parse('2026-11-14T00:00:00Z');
const rdapBody = {
  events: [
    { eventAction: 'last changed', eventDate: '2026-11-10T00:00:00Z' },
    { eventAction: 'registration', eventDate: '2026-11-08T00:00:00Z' },
  ],
  entities: [
    { roles: ['registrant'], handle: 'REDACTED' },
    {
      roles: ['registrar'],
      handle: '9999',
      vcardArray: [
        'vcard',
        [
          ['version', {}, 'text', '4.0'],
          ['fn', {}, 'text', 'Example Registrar Ltd'],
        ],
      ],
    },
  ],
};

afterEach(() => vi.unstubAllEnvs());

describe('lookupDomainAge', () => {
  it('reads the registration date and registrar from rdap.org', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify(rdapBody), { status: 200 }));
    const age = DomainAgeSchema.parse(
      await lookupDomainAge('hdfcbenk.top', { fetch, now: () => NOW }),
    );
    expect(age).toEqual({
      domain: 'hdfcbenk.top',
      registered: '2026-11-08T00:00:00.000Z',
      ageDays: 6,
      registrar: 'Example Registrar Ltd',
    });
    expect(fetch).toHaveBeenCalledWith(
      'https://rdap.org/domain/hdfcbenk.top',
      expect.objectContaining({ redirect: 'follow' }),
    );
  });

  it('returns "unavailable" for registries without RDAP, errors and replies without a date', async () => {
    for (const fetch of [
      vi.fn(async () => new Response('not found', { status: 404 })),
      vi.fn(async () => Promise.reject(new Error('timeout'))),
      vi.fn(async () => new Response(JSON.stringify({ events: [] }), { status: 200 })),
    ]) {
      expect(await lookupDomainAge('example.co.in', { fetch, now: () => NOW })).toMatchObject({
        domain: 'example.co.in',
        error: 'unavailable',
      });
    }
  });

  it('accepts registrable domains only', () => {
    expect(registrableDomain('Example.COM')).toBe('example.com');
    expect(registrableDomain('sbi.co.in')).toBe('sbi.co.in');
    for (const bad of ['www.example.com', '127.0.0.1', 'localhost', 'not a domain', 'co.in', ''])
      expect(() => registrableDomain(bad), bad).toThrow();
  });
});

describe('GET /api/domain-age', () => {
  it('answers 400 for anything but a registrable domain', async () => {
    const res = await domainAge(
      new Request('http://localhost/api/domain-age?domain=www.example.com', {
        headers: { 'x-forwarded-for': '5.5.5.5' },
      }),
    );
    expect(res.status).toBe(400);
  });
});

describe('GET /api/health', () => {
  it('reports configured providers (key and model), never their values', async () => {
    vi.stubEnv('GROQ_API_KEY', 'secret-groq');
    vi.stubEnv('GROQ_MODEL', 'some-model');
    vi.stubEnv('GEMINI_API_KEY', '');
    const res = await health(new Request('http://localhost/api/health'));
    const text = await res.text();
    expect(text).not.toContain('secret-groq');
    const body = HealthResponseSchema.parse(JSON.parse(text));
    expect(body.ai).toEqual({ groq: true, gemini: false });
    expect(body.version).toMatch(/^\d+\.\d+\.\d+/);
  });
});

describe('rate limiter', () => {
  it('uses the §12.6 limits with a 60 s sliding window', () => {
    resetRateLimits();
    expect(LIMITS).toEqual({
      ai: 20,
      ask: 20,
      expand: 60,
      'domain-age': 60,
      reports: 60,
      analyze: 30,
      telegram: 20,
    });
    const t = 1_000_000;
    for (let i = 0; i < 60; i++) expect(checkRate('expand', '1.2.3.4', t + i).ok).toBe(true);
    const blocked = checkRate('expand', '1.2.3.4', t + 100);
    expect(blocked.ok).toBe(false);
    expect(checkRate('expand', '5.6.7.8', t + 100).ok).toBe(true); // per IP
    expect(checkRate('ai', '1.2.3.4', t + 100).ok).toBe(true); // per route
    expect(checkRate('expand', '1.2.3.4', t + 60_001).ok).toBe(true); // window slides
  });
});
