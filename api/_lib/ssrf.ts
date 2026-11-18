/**
 * Redirect expansion with an SSRF guard (SPEC_A_ENGINE.md §12.2).
 *
 * - http/https only, URL ≤ 2,048 chars, no credentials, ports 80/443 only;
 * - before every hop the hostname is resolved (all addresses) and the hop is refused if any
 *   address is private or reserved (IPv4 and IPv6, including IPv4-mapped and NAT64 forms);
 * - the real fetch uses an undici Agent whose connect-time DNS lookup applies the same check, so
 *   a DNS answer that changes between the check and the connection (rebinding) is refused too;
 * - redirect: 'manual', HEAD first (GET when HEAD is rejected, aborted as soon as headers arrive),
 *   3 s per hop, max 5 hops; only hops and the final URL are returned, never page content.
 */
import { lookup as dnsLookup } from 'node:dns';
import { isIP, type LookupFunction } from 'node:net';
import type { RedirectChain } from '@akshi/contracts';

export const MAX_HOPS = 5;
export const HOP_TIMEOUT_MS = 3_000;
export const MAX_URL_LENGTH = 2_048;
export const USER_AGENT = 'AkshiRakshakLinkCheck/1.0 (+https://akshi-rakshak.vercel.app)';

export class SsrfError extends Error {
  constructor(
    public code:
      | 'private_address'
      | 'dns_failed'
      | 'bad_scheme'
      | 'bad_port'
      | 'credentials'
      | 'too_long'
      | 'bad_url',
  ) {
    super(code);
  }
}

// ───────────── address classification ─────────────

const V4_BLOCKS: [string, number][] = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
];

function v4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const v = Number(p);
    if (v > 255) return null;
    n = n * 256 + v;
  }
  return n;
}

export function isPrivateIPv4(ip: string): boolean {
  const n = v4ToInt(ip);
  if (n === null) return true; // unparseable: refuse
  return V4_BLOCKS.some(([base, bits]) => {
    const b = v4ToInt(base)!;
    const size = 2 ** (32 - bits);
    return n >= b && n < b + size;
  });
}

/** Expand an IPv6 address to 8 hextets (handles '::' and a trailing dotted IPv4). */
export function expandIPv6(ip: string): number[] | null {
  let s =
    ip
      .toLowerCase()
      .replace(/^\[|\]$/g, '')
      .split('%')[0] ?? '';
  const dotted = /(\d{1,3}(?:\.\d{1,3}){3})$/.exec(s);
  if (dotted) {
    const n = v4ToInt(dotted[1]!);
    if (n === null) return null;
    s = `${s.slice(0, -dotted[1]!.length)}${(n >>> 16).toString(16)}:${(n & 0xffff).toString(16)}`;
  }
  const halves = s.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 1 && missing !== 0) return null;
  if (missing < 0) return null;
  const all = [...head, ...Array(halves.length === 2 ? missing : 0).fill('0'), ...tail];
  const out = all.map((h) => (/^[0-9a-f]{1,4}$/.test(h) ? parseInt(h, 16) : NaN));
  return out.length === 8 && out.every((h) => Number.isFinite(h)) ? out : null;
}

export function isPrivateIPv6(ip: string): boolean {
  const h = expandIPv6(ip);
  if (!h) return true;
  const [a = 0, b = 0, c = 0, d = 0, e = 0, f = 0, g = 0, last = 0] = h;
  const embeddedV4 = () => `${g >> 8}.${g & 0xff}.${last >> 8}.${last & 0xff}`;
  if (h.every((x) => x === 0)) return true; // ::
  if (a === 0 && b === 0 && c === 0 && d === 0 && e === 0 && f === 0 && g === 0 && last === 1)
    return true; // ::1
  if (a === 0 && b === 0 && c === 0 && d === 0 && e === 0 && (f === 0xffff || f === 0))
    return isPrivateIPv4(embeddedV4()); // mapped / compat
  if (a === 0x64 && b === 0xff9b) return isPrivateIPv4(embeddedV4()); // NAT64
  if ((a & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((a & 0xffc0) === 0xfe80) return true; // fe80::/10 link local
  if ((a & 0xff00) === 0xff00) return true; // multicast
  if (a === 0x2001 && b === 0x0db8) return true; // documentation
  if (a === 0x2002) return isPrivateIPv4(`${b >> 8}.${b & 0xff}.${c >> 8}.${c & 0xff}`); // 6to4
  return false;
}

export function isPrivateAddress(ip: string): boolean {
  const v = isIP(ip.replace(/^\[|\]$/g, ''));
  if (v === 4) return isPrivateIPv4(ip);
  if (v === 6) return isPrivateIPv6(ip);
  return true;
}

// ───────────── URL and DNS checks ─────────────

export type LookupFn = (hostname: string) => Promise<{ address: string; family: number }[]>;

export const systemLookup: LookupFn = (hostname) =>
  new Promise((resolve, reject) =>
    dnsLookup(hostname, { all: true, verbatim: true }, (err, addrs) =>
      err ? reject(err) : resolve(addrs),
    ),
  );

/** Throws SsrfError when the URL itself is not allowed. */
export function checkTarget(raw: string): URL {
  if (raw.length > MAX_URL_LENGTH) throw new SsrfError('too_long');
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new SsrfError('bad_url');
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new SsrfError('bad_scheme');
  if (u.username || u.password) throw new SsrfError('credentials');
  if (u.port && u.port !== '80' && u.port !== '443') throw new SsrfError('bad_port');
  return u;
}

/** Resolves the host (or takes a literal IP) and refuses private or reserved addresses. */
export async function assertPublicHost(hostname: string, lookup: LookupFn): Promise<void> {
  const host = hostname.replace(/^\[|\]$/g, '');
  if (isIP(host)) {
    if (isPrivateAddress(host)) throw new SsrfError('private_address');
    return;
  }
  let addrs: { address: string }[];
  try {
    addrs = await lookup(host);
  } catch {
    throw new SsrfError('dns_failed');
  }
  if (!addrs.length) throw new SsrfError('dns_failed');
  if (addrs.some((a) => isPrivateAddress(a.address))) throw new SsrfError('private_address');
}

// ───────────── fetching ─────────────

export interface HopResponse {
  status: number;
  location: string | null;
}
export type HopFetch = (
  url: string,
  method: 'HEAD' | 'GET',
  signal: AbortSignal,
) => Promise<HopResponse>;

/** Connect-time DNS lookup that refuses private or reserved answers (same rule as assertPublicHost). */
const guardedLookup: LookupFunction = (hostname, options, cb) => {
  dnsLookup(hostname, { all: true, verbatim: true }, (err, addrs) => {
    if (err) return cb(err, '', 0);
    const first = addrs[0];
    if (!first || addrs.some((a) => isPrivateAddress(a.address)))
      return cb(new SsrfError('private_address'), '', 0);
    if ((options as { all?: boolean } | undefined)?.all) cb(null, addrs);
    else cb(null, first.address, first.family);
  });
};

let agent: unknown = null;
/** Real network fetch: undici with a guarded connect-time lookup (defeats DNS rebinding). */
export const guardedFetch: HopFetch = async (url, method, signal) => {
  const { Agent, fetch } = await import('undici');
  agent ??= new Agent({
    connect: {
      lookup: guardedLookup,
    },
  });
  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort();
  signal.addEventListener('abort', onAbort, { once: true });
  try {
    const res = await fetch(url, {
      method,
      redirect: 'manual',
      signal: ctrl.signal,
      headers: { 'user-agent': USER_AGENT, accept: '*/*' },
      dispatcher: agent as InstanceType<typeof Agent>,
    });
    const out = { status: res.status, location: res.headers.get('location') };
    ctrl.abort(); // headers are all we need; never read the body
    return out;
  } finally {
    signal.removeEventListener('abort', onAbort);
  }
};

export interface ExpandDeps {
  fetch?: HopFetch;
  lookup?: LookupFn;
  hopTimeoutMs?: number;
}

const cache = new Map<string, { at: number; chain: RedirectChain }>();
const CACHE_MS = 10 * 60_000;

export async function expandUrl(raw: string, deps: ExpandDeps = {}): Promise<RedirectChain> {
  const doFetch = deps.fetch ?? guardedFetch;
  const lookup = deps.lookup ?? systemLookup;
  const start = checkTarget(raw).href;
  const cached = cache.get(start);
  if (cached && Date.now() - cached.at < CACHE_MS && !deps.fetch) return cached.chain;

  const hops: RedirectChain['hops'] = [];
  let current = start;
  let chain: RedirectChain | null = null;
  for (let i = 0; i < MAX_HOPS; i++) {
    try {
      const u = checkTarget(current);
      await assertPublicHost(u.hostname, lookup);
      const signal = AbortSignal.timeout(deps.hopTimeoutMs ?? HOP_TIMEOUT_MS);
      let res = await doFetch(u.href, 'HEAD', signal);
      if (res.status === 405 || res.status === 501 || res.status === 403)
        res = await doFetch(u.href, 'GET', signal);
      hops.push({ url: u.href, status: res.status });
      if (res.status >= 300 && res.status < 400 && res.location) {
        current = new URL(res.location, u).href;
        continue;
      }
      chain = { hops, finalUrl: u.href, truncated: false };
      break;
    } catch (err) {
      const code =
        err instanceof SsrfError
          ? err.code
          : (err as { name?: string })?.name === 'TimeoutError'
            ? 'timeout'
            : 'unreachable';
      chain = {
        hops,
        finalUrl: current,
        truncated: false,
        error: code === 'private_address' ? 'blocked_private_address' : code,
      };
      break;
    }
  }
  chain ??= { hops, finalUrl: current, truncated: true };
  if (!deps.fetch) {
    cache.set(start, { at: Date.now(), chain });
    if (cache.size > 500) cache.delete(cache.keys().next().value as string);
  }
  return chain;
}
