/**
 * Splits a URL into the parts URLAnatomy colours (SPEC_B_WEB.md §5.6): scheme,
 * subdomain, registrable domain, path and query. The engine's registrableDomain is
 * used when it is a real suffix of the host; otherwise a small heuristic covers
 * Indian second-level domains (co.in, gov.in, bank.in …).
 */
export interface UrlParts {
  scheme: string;
  /** "user@" or "user:pass@" before the host — a classic trick, shown separately */
  userinfo: string;
  subdomain: string;
  domain: string;
  port: string;
  path: string;
  query: string;
  hash: string;
  host: string;
  isIp: boolean;
  isPunycode: boolean;
}

const SECOND_LEVEL = new Set([
  'co',
  'com',
  'net',
  'org',
  'gov',
  'ac',
  'edu',
  'nic',
  'res',
  'gen',
  'firm',
  'ind',
  'mil',
  'bank',
]);
const IPV4 = /^\d{1,3}(?:\.\d{1,3}){3}$/;

export function guessRegistrable(host: string): string {
  const h = host.toLowerCase().replace(/\.$/, '');
  if (IPV4.test(h) || h.startsWith('[')) return h;
  const labels = h.split('.');
  if (labels.length <= 2) return h;
  const sld = labels[labels.length - 2] ?? '';
  const tld = labels[labels.length - 1] ?? '';
  const take = tld.length === 2 && SECOND_LEVEL.has(sld) ? 3 : 2;
  return labels.slice(-take).join('.');
}

export function parseUrl(raw: string, registrableDomain?: string): UrlParts | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  let u: URL;
  try {
    u = new URL(withScheme);
  } catch {
    return null;
  }
  if (!u.hostname) return null;
  const host = u.hostname.toLowerCase();
  const engineDomain = registrableDomain?.toLowerCase();
  const domain =
    engineDomain && (host === engineDomain || host.endsWith(`.${engineDomain}`))
      ? engineDomain
      : guessRegistrable(host);
  const subdomain =
    host.length > domain.length ? host.slice(0, host.length - domain.length - 1) : '';
  const userinfo = u.username
    ? `${decodeURIComponent(u.username)}${u.password ? ':•••' : ''}@`
    : '';
  return {
    scheme: u.protocol.replace(/:$/, ''),
    userinfo,
    subdomain,
    domain,
    port: u.port,
    path: u.pathname === '/' ? '' : u.pathname,
    query: u.search,
    hash: u.hash,
    host,
    isIp: IPV4.test(host) || host.startsWith('['),
    isPunycode: host.split('.').some((l) => l.startsWith('xn--')),
  };
}

export interface DiffCell {
  char: string;
  /** different from the official domain at this position */
  diff: boolean;
}

/**
 * Character rows for the lookalike comparison: the official domain and the actual
 * one, with the engine's lookalikeDiff positions marked on the actual row.
 */
export function lookalikeRows(
  official: string,
  actual: string,
  diff: { index: number; expected: string; actual: string }[] = [],
): { official: DiffCell[]; actual: DiffCell[] } {
  const marked = new Set(diff.map((d) => d.index));
  const actualChars = [...actual];
  const officialChars = [...official];
  // Without engine diff data, mark positions that differ character by character.
  const fallback = diff.length === 0;
  return {
    official: officialChars.map((char, i) => ({
      char,
      diff: marked.has(i) || (fallback && actualChars[i] !== char),
    })),
    actual: actualChars.map((char, i) => ({
      char,
      diff: marked.has(i) || (fallback && officialChars[i] !== char),
    })),
  };
}
