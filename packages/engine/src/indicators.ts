/**
 * Indicator and blocklist lookup (SPEC_A_ENGINE.md §6.3, §8.1).
 * Values are compared in canonical form: lower-case UPI IDs and domains, E.164 phones.
 */
import type { IndicatorMatch } from '@akshi/contracts';
import { INDICATORS } from '@akshi/content';
import { parse } from 'tldts-icann';

/** Canonical form used for indicator and blocklist comparison. */
export function canonicalValue(
  value: string,
): { value: string; type: IndicatorMatch['type'] } | null {
  const v = value.trim().toLowerCase();
  if (!v) return null;
  const digits = v.replace(/[\s()-]/g, '');
  if (/^(?:\+?91|0)?[6-9]\d{9}$/.test(digits))
    return { value: `+91${digits.slice(-10)}`, type: 'phone' };
  if (/^[a-z0-9.\-_]{2,256}@[a-z][a-z0-9]{1,63}$/.test(v)) return { value: v, type: 'upi' };
  const host = v.replace(/^[a-z]+:\/\//, '').split(/[/?#:]/)[0] ?? '';
  const domain = parse(host).domain;
  if (domain) return { value: domain, type: 'domain' };
  return null;
}

const INDEX = new Map<string, (typeof INDICATORS)[number]>();
for (const i of INDICATORS) {
  const c = canonicalValue(i.value);
  if (c) INDEX.set(`${c.type}:${c.value}`, i);
}

export function lookupIndicator(value: string): IndicatorMatch | null {
  const c = canonicalValue(value);
  if (!c) return null;
  const hit = INDEX.get(`${c.type}:${c.value}`);
  if (!hit) return null;
  const match: IndicatorMatch = {
    value: hit.value,
    type: hit.type,
    reports: hit.reports,
    category: hit.category,
    source: 'bundled',
    sampleData: hit.sampleData,
  };
  if (hit.campaign) match.campaign = hit.campaign;
  return match;
}

/** Blocklist match (values the user blocked, from web storage). */
export function blocklistMatch(
  value: string,
  blocklist: readonly string[] | undefined,
): IndicatorMatch | null {
  if (!blocklist?.length) return null;
  const c = canonicalValue(value);
  if (!c) return null;
  const blocked = blocklist.some((b) => {
    const cb = canonicalValue(b);
    return cb !== null && cb.type === c.type && cb.value === c.value;
  });
  return blocked
    ? { value: c.value, type: c.type, reports: 0, source: 'blocklist', sampleData: false }
    : null;
}
