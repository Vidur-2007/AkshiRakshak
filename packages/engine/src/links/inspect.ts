/**
 * URL inspector (SPEC_A_ENGINE.md §6.2).
 *
 * Local (offline) checks: parse, tldts registrable domain, official match (brand domains, brand
 * TLDs, `bank.in` for banks, `gov.in`/`nic.in` for government), lookalikes with a character diff,
 * shortener, raw IP, risky TLD, punycode, APK, plain-http login pages.
 * Network extras (only through src/net.ts): redirect expansion and domain age, run in parallel
 * with a 3-second total budget; any failure is silent and the local finding stands.
 */
import {
  DomainAgeSchema,
  RedirectChainSchema,
  type SignalId,
  type Span,
  type UrlFinding,
} from '@akshi/contracts';
import { parse } from 'tldts';
import { getJson } from '../net';
import { CATALOG } from '../rules/catalog';
import { findLookalike } from './lookalike';
import { toUnicodeHost } from './punycode';
import { BANK_SUFFIX, BRANDS, GOVT_SUFFIXES, RISKY_TLDS, SHORTENERS, type Brand } from './registry';

/** Noisy-OR of positive flag weights × 100 (same formula as SPEC_A §8.1). */
export function noisyOrRisk(
  flags: readonly SignalId[],
  overrides: Partial<Record<SignalId, number>> = {},
): number {
  let keep = 1;
  for (const f of new Set(flags)) {
    const w = overrides[f] ?? CATALOG[f].weight;
    if (w > 0) keep *= 1 - w;
  }
  return Math.round(100 * (1 - keep));
}

/** Is this registrable domain official for the brand (lists, brand TLDs, suffix rules)? */
export function isOfficialFor(
  brand: Brand,
  registrableDomain: string,
  publicSuffix: string,
): boolean {
  if (brand.domains.includes(registrableDomain)) return true;
  if (brand.tlds?.includes(publicSuffix)) return true;
  if (brand.kind === 'bank' && publicSuffix === BANK_SUFFIX) return true;
  if (brand.kind === 'govt' && GOVT_SUFFIXES.includes(publicSuffix)) return true;
  return false;
}

/** Brand that owns this domain outright, if any (used when the message names no brand). */
export function officialOwner(
  registrableDomain: string,
  publicSuffix: string,
): Brand | 'bank' | 'govt' | null {
  for (const b of BRANDS) {
    if (b.domains.includes(registrableDomain) || b.tlds?.includes(publicSuffix)) return b;
  }
  if (publicSuffix === BANK_SUFFIX) return 'bank';
  if (GOVT_SUFFIXES.includes(publicSuffix)) return 'govt';
  return null;
}

export interface InspectContext {
  /** brands the surrounding message claims; when set, isOfficial means official for one of them */
  claimed?: readonly Brand[];
}

/** Extra per-URL facts the pipeline needs (not in the UrlFinding contract). */
export interface UrlMeta {
  publicSuffix: string;
  /** brand the URL imitates, when LOOKALIKE_DOMAIN fired */
  imitates?: Brand;
  /** well-known owner of the domain (a brand, or any bank / government domain), if any */
  owner?: Brand | 'bank' | 'govt';
}

const META = new WeakMap<UrlFinding, UrlMeta>();
export const urlMeta = (u: UrlFinding): UrlMeta | undefined => META.get(u);

const LOGIN_PATH =
  /(?:log-?in|sign-?in|kyc|verify|verification|update|secure|account|netbanking|password|otp|reward|refund|claim)/i;

export function inspectUrlLocal(raw: string, span?: Span, ctx: InspectContext = {}): UrlFinding {
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `http://${raw}`;
  let host: string;
  let normalized = withScheme;
  let path = '';
  let protocol = 'http:';
  try {
    const u = new URL(withScheme);
    host = u.hostname.toLowerCase().replace(/\.$/, '');
    normalized = u.href;
    path = `${u.pathname}${u.search}`;
    protocol = u.protocol;
  } catch {
    host =
      raw
        .toLowerCase()
        .replace(/^[a-z]+:\/\//, '')
        .split(/[/?#:]/)[0] ?? '';
  }
  const p = parse(host);
  const isIp = p.isIp === true || /^\[.*\]$/.test(host);
  const registrableDomain = isIp ? host : (p.domain ?? host);
  const publicSuffix = isIp ? '' : (p.publicSuffix ?? host.split('.').at(-1) ?? '');
  const isShortener = SHORTENERS.has(registrableDomain);
  const isApk = /\.apk(?:$|[?#&/])/i.test(path) || /[?&][^=]*=?[^&]*\.apk\b/i.test(path);
  const unicodeHost = toUnicodeHost(host);
  const hasUnicode = unicodeHost !== host && /[^\x20-\x7e]/.test(unicodeHost);

  const owner = isIp ? null : officialOwner(registrableDomain, publicSuffix);
  const claimed = ctx.claimed ?? [];
  const isOfficial = claimed.length
    ? claimed.some((b) => isOfficialFor(b, registrableDomain, publicSuffix))
    : owner !== null;

  const flags: SignalId[] = [];
  const meta: UrlMeta = { publicSuffix };
  if (isShortener) flags.push('SHORTENED_URL');
  if (isIp) flags.push('IP_URL');
  if (!isIp && RISKY_TLDS.has(publicSuffix.split('.').at(-1) ?? '')) flags.push('RISKY_TLD');
  if (hasUnicode) flags.push('PUNYCODE');
  if (isApk) flags.push('APK_LINK');

  let lookalikeOf: string | undefined;
  let lookalikeDiff: UrlFinding['lookalikeDiff'];
  if (!isIp && owner === null && !isShortener) {
    const unicodeDomain = toUnicodeHost(registrableDomain);
    const suffixLen = publicSuffix ? publicSuffix.length + 1 : 0;
    const label = unicodeDomain.slice(0, unicodeDomain.length - suffixLen);
    const sub = unicodeHost.slice(0, Math.max(0, unicodeHost.length - unicodeDomain.length - 1));
    const labelOffset = sub ? sub.length + 1 : 0;
    const m = findLookalike(registrableDomain, label, sub, labelOffset);
    if (m) {
      flags.push('LOOKALIKE_DOMAIN');
      lookalikeOf = m.lookalikeOf;
      if (m.diff?.length) lookalikeDiff = m.diff;
      meta.imitates = m.brand;
    }
  }
  if (!isOfficial && protocol === 'http:' && LOGIN_PATH.test(path)) flags.push('SUSPICIOUS_LINK');
  if (owner) meta.owner = owner;
  if (isOfficial) flags.push('OFFICIAL_DOMAIN');

  const risk = isOfficial ? Math.min(10, noisyOrRisk(flags)) : noisyOrRisk(flags);
  const finding: UrlFinding = {
    raw,
    normalized,
    host: unicodeHost,
    registrableDomain,
    tld: publicSuffix,
    risk,
    flags,
    isOfficial,
    isShortener,
    isApk,
  };
  if (span) finding.span = span;
  if (lookalikeOf) finding.lookalikeOf = lookalikeOf;
  if (lookalikeDiff) finding.lookalikeDiff = lookalikeDiff;
  META.set(finding, meta);
  return finding;
}

/** Recompute risk after flags change (official domains capped at 10). */
export function rescoreUrl(u: UrlFinding): void {
  const ageOverride =
    u.domainAge?.ageDays !== undefined && u.domainAge.ageDays < 30 ? { NEW_DOMAIN: 0.45 } : {};
  const r = noisyOrRisk(u.flags, ageOverride);
  u.risk = u.isOfficial ? Math.min(10, r) : r;
}

export interface NetworkOptions {
  expand?: boolean;
  domainAge?: boolean;
  signal?: AbortSignal;
  /** total budget for all network extras, ms (default 3000) */
  budgetMs?: number;
}

const isOnline = () =>
  (globalThis as { navigator?: { onLine?: boolean } }).navigator?.onLine !== false;

/**
 * Network extras for one finding (mutates and returns it). Expansion runs for shorteners and
 * non-official links; the final URL is inspected once more. Domain age runs for non-official,
 * non-IP domains: < 90 days → NEW_DOMAIN (weight 0.45 when < 30 days). Never waits past the budget.
 */
export async function inspectUrlNetwork(
  u: UrlFinding,
  opts: NetworkOptions = {},
  ctx: InspectContext = {},
): Promise<{ finding: UrlFinding; used: boolean }> {
  if (!isOnline()) return { finding: u, used: false };
  const budget = opts.budgetMs ?? 3000;
  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort();
  opts.signal?.addEventListener('abort', onAbort, { once: true });
  const timer = setTimeout(() => ctrl.abort(), budget);
  let used = false;
  const doExpand = opts.expand !== false && (u.isShortener || !u.isOfficial);
  const doAge = opts.domainAge !== false && !u.isOfficial && !u.flags.includes('IP_URL');
  try {
    // hard budget: even a fetch that ignores its AbortSignal cannot hold the scan
    const deadline = new Promise<null>((resolve) => setTimeout(() => resolve(null), budget));
    const [chainRaw, ageRaw] = await Promise.all([
      doExpand
        ? Promise.race([
            getJson(`/api/expand?url=${encodeURIComponent(u.normalized)}`, {
              timeoutMs: budget,
              signal: ctrl.signal,
            }),
            deadline,
          ])
        : null,
      doAge
        ? Promise.race([
            getJson(`/api/domain-age?domain=${encodeURIComponent(u.registrableDomain)}`, {
              timeoutMs: budget,
              signal: ctrl.signal,
            }),
            deadline,
          ])
        : null,
    ]);
    if (ctrl.signal.aborted) return { finding: u, used: false };
    const chain = RedirectChainSchema.safeParse(chainRaw);
    if (chain.success && !ctrl.signal.aborted) {
      used = true;
      u.expanded = chain.data;
      const final = inspectUrlLocal(chain.data.finalUrl, undefined, ctx);
      const crossDomain = final.registrableDomain !== u.registrableDomain;
      if (chain.data.hops.length >= 3 || (crossDomain && final.risk >= 15))
        u.flags.push('REDIRECT_CHAIN');
      if (crossDomain) {
        for (const f of final.flags)
          if (f !== 'OFFICIAL_DOMAIN' && !u.flags.includes(f)) u.flags.push(f);
        if (final.lookalikeOf && !u.lookalikeOf) u.lookalikeOf = final.lookalikeOf;
        const fm = urlMeta(final);
        const um = urlMeta(u);
        if (fm?.imitates && um && !um.imitates) um.imitates = fm.imitates;
      }
    }
    const age = DomainAgeSchema.safeParse(ageRaw);
    if (age.success && !ctrl.signal.aborted) {
      used = true;
      u.domainAge = age.data;
      if (
        age.data.ageDays !== undefined &&
        age.data.ageDays < 90 &&
        !u.flags.includes('NEW_DOMAIN')
      )
        u.flags.push('NEW_DOMAIN');
    }
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener('abort', onAbort);
  }
  rescoreUrl(u);
  return { finding: u, used };
}

/** Run network extras for several URLs in parallel under one shared budget. */
export async function inspectUrlsNetwork(
  urls: UrlFinding[],
  opts: NetworkOptions = {},
  ctx: InspectContext = {},
): Promise<boolean> {
  if (!urls.length || (opts.expand === false && opts.domainAge === false)) return false;
  const results = await Promise.all(urls.slice(0, 5).map((u) => inspectUrlNetwork(u, opts, ctx)));
  return results.some((r) => r.used);
}
