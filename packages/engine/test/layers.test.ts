/**
 * C's eval configurations (SPEC.md §6.2) depend on analyze() honouring options.layers and the
 * network switches exactly: a layer that is off is unavailable, contributes nothing and never
 * runs; expandLinks: false + domainAge: false never touch the network.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { analyze, warmup } from '../src/index';

const TEXT =
  'Dear customer, your SBI account will be blocked today. Update KYC at http://sbi-kyc-update.xyz/verify or pay to refund.desk@okaxis and share the OTP.';
const NO_NET = { expandLinks: false, domainAge: false } as const;

afterEach(() => vi.unstubAllGlobals());

describe('options.layers and network switches', () => {
  it.each(['model', 'links', 'indicators', 'ai'] as const)(
    'layers.%s = false turns that layer off',
    async (layer) => {
      await warmup();
      const fetch = vi.fn(async (_url: string) => new Response('{}', { status: 503 }));
      vi.stubGlobal('fetch', fetch);
      const r = await analyze({
        kind: 'message',
        text: TEXT,
        lang: 'en',
        options: { ...NO_NET, cloudAI: true, layers: { [layer]: false } },
      });
      const l = r.layers.find((x) => x.layer === layer)!;
      expect(l.available).toBe(false);
      expect(l.share).toBe(0);
      if (layer === 'links') {
        // URL and UPI checks are part of the links layer
        expect(r.layers.find((x) => x.layer === 'upi')?.available).toBe(false);
        expect(r.layers.find((x) => x.layer === 'links')?.score).toBe(0);
        expect(r.signals.some((s) => s.source === 'url' || s.source === 'upi')).toBe(false);
      }
      if (layer === 'model') {
        expect(r.signals.some((s) => s.id === 'MODEL_PATTERN')).toBe(false);
        expect(r.stages.find((s) => s.stage === 'model')?.status).toBe('skipped');
      }
      if (layer === 'indicators')
        expect(r.signals.some((s) => s.id === 'KNOWN_INDICATOR')).toBe(false);
      if (layer === 'ai') {
        expect(r.aiUsed).toBe(false);
        expect(fetch.mock.calls.some(([u]) => String(u).includes('/api/ai/'))).toBe(false);
      }
    },
  );

  it('expandLinks: false and domainAge: false never call the network', async () => {
    const fetch = vi.fn(async () => new Response('{}'));
    vi.stubGlobal('fetch', fetch);
    const r = await analyze({ kind: 'message', text: TEXT, lang: 'en', options: NO_NET });
    expect(fetch).not.toHaveBeenCalled();
    expect(r.entities.urls[0]?.expanded).toBeUndefined();
    expect(r.entities.urls[0]?.domainAge).toBeUndefined();
  });

  it('each switch alone limits the calls to its own endpoint', async () => {
    const urls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (u: string) => {
        urls.push(String(u));
        return new Response('{}', { status: 503 });
      }),
    );
    await analyze({
      kind: 'message',
      text: TEXT,
      lang: 'en',
      options: { expandLinks: true, domainAge: false },
    });
    expect(urls.length).toBeGreaterThan(0);
    expect(urls.every((u) => u.includes('/api/expand'))).toBe(true);
    urls.length = 0;
    await analyze({
      kind: 'message',
      text: TEXT,
      lang: 'en',
      options: { expandLinks: false, domainAge: true },
    });
    expect(urls.length).toBeGreaterThan(0);
    expect(urls.every((u) => u.includes('/api/domain-age'))).toBe(true);
  });
});
