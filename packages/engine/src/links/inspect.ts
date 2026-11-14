/**
 * URL inspector (SPEC_A_ENGINE.md §6.2).
 * P1: local structural checks (parse, tldts, shortener, raw IP, risky TLD, punycode, APK).
 * P2: official domains, lookalikes and diffs, brand-in-subdomain, http+login paths,
 *     and the network extras (/api/expand, /api/domain-age).
 */
import type { SignalId, Span, UrlFinding } from '@akshi/contracts';
import { parse } from 'tldts';
import { CATALOG } from '../rules/catalog';
import { RISKY_TLDS, SHORTENERS } from './registry';

/** Noisy-OR of positive flag weights × 100 (same formula as SPEC_A §8.1). */
export function noisyOrRisk(flags: SignalId[]): number {
  let keep = 1;
  for (const f of new Set(flags)) {
    const w = CATALOG[f].weight;
    if (w > 0) keep *= 1 - w;
  }
  return Math.round(100 * (1 - keep));
}

export function inspectUrlLocal(raw: string, span?: Span): UrlFinding {
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `http://${raw}`;
  let host: string;
  let normalized = withScheme;
  let path = '';
  try {
    const u = new URL(withScheme);
    host = u.hostname.toLowerCase().replace(/\.$/, '');
    normalized = u.href;
    path = `${u.pathname}${u.search}`;
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
  const tld = isIp ? '' : (p.publicSuffix ?? host.split('.').at(-1) ?? '');
  const isShortener = SHORTENERS.has(registrableDomain);
  const isApk = /\.apk(?:$|[?#&/])/i.test(path) || /[?&][^=]*=?[^&]*\.apk\b/i.test(path);

  const flags: SignalId[] = [];
  if (isShortener) flags.push('SHORTENED_URL');
  if (isIp) flags.push('IP_URL');
  if (!isIp && RISKY_TLDS.has(tld.split('.').at(-1) ?? '')) flags.push('RISKY_TLD');
  if (host.split('.').some((l) => l.startsWith('xn--'))) flags.push('PUNYCODE');
  if (isApk) flags.push('APK_LINK');

  const finding: UrlFinding = {
    raw,
    normalized,
    host,
    registrableDomain,
    tld,
    risk: noisyOrRisk(flags),
    flags,
    isOfficial: false,
    isShortener,
    isApk,
  };
  if (span) finding.span = span;
  return finding;
}
