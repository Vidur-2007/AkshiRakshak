/**
 * Domain age via RDAP (SPEC_A_ENGINE.md §12.3). rdap.org redirects to the right registry.
 * Registration date from the `registration` event, registrar from the entity with role
 * `registrar`. Registries that do not answer RDAP give `{ domain, error: 'unavailable' }`.
 * Cached for 1 hour (failures for 10 minutes).
 */
import type { DomainAge } from '@akshi/contracts';
import { parse } from 'tldts';
import { USER_AGENT } from './ssrf.js';

export const RDAP_TIMEOUT_MS = 5_000;
const OK_MS = 60 * 60_000;
const FAIL_MS = 10 * 60_000;
const cache = new Map<string, { at: number; ttl: number; value: DomainAge }>();

export class BadDomainError extends Error {}

/** The registrable domain, lower case; throws for anything else (subdomains, IPs, junk). */
export function registrableDomain(input: string): string {
  const d = input.trim().toLowerCase().replace(/\.$/, '');
  const p = parse(d);
  if (!d || d.length > 253 || p.isIp || p.isIcann !== true || !p.domain || p.domain !== d)
    throw new BadDomainError(d);
  return d;
}

interface RdapEntity {
  roles?: string[];
  handle?: string;
  vcardArray?: [string, [string, unknown, string, unknown][]];
}
interface RdapDomain {
  events?: { eventAction?: string; eventDate?: string }[];
  entities?: RdapEntity[];
}

function registrarName(entities: RdapEntity[] | undefined): string | undefined {
  const r = entities?.find((e) => e.roles?.includes('registrar'));
  if (!r) return undefined;
  const fn = r.vcardArray?.[1]?.find((v) => v[0] === 'fn')?.[3];
  return typeof fn === 'string' && fn.trim() ? fn.trim() : r.handle;
}

export type RdapFetch = (url: string, init: RequestInit) => Promise<Response>;

export async function lookupDomainAge(
  domain: string,
  deps: { fetch?: RdapFetch; now?: () => number } = {},
): Promise<DomainAge> {
  const d = registrableDomain(domain);
  const now = deps.now ?? Date.now;
  const hit = cache.get(d);
  if (hit && now() - hit.at < hit.ttl && !deps.fetch) return hit.value;

  const doFetch = deps.fetch ?? ((url: string, init: RequestInit) => fetch(url, init));
  let value: DomainAge;
  try {
    const res = await doFetch(`https://rdap.org/domain/${encodeURIComponent(d)}`, {
      headers: { accept: 'application/rdap+json, application/json', 'user-agent': USER_AGENT },
      redirect: 'follow',
      signal: AbortSignal.timeout(RDAP_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`rdap ${res.status}`);
    const body = (await res.json()) as RdapDomain;
    const reg = body.events?.find((e) => e.eventAction === 'registration')?.eventDate;
    const time = reg ? Date.parse(reg) : NaN;
    value = { domain: d };
    if (Number.isFinite(time)) {
      value.registered = new Date(time).toISOString();
      value.ageDays = Math.max(0, Math.floor((now() - time) / 86_400_000));
    }
    const registrar = registrarName(body.entities);
    if (registrar) value.registrar = registrar;
    if (value.ageDays === undefined) value.error = 'unavailable';
  } catch {
    value = { domain: d, error: 'unavailable' };
  }
  if (!deps.fetch) cache.set(d, { at: now(), ttl: value.error ? FAIL_MS : OK_MS, value });
  return value;
}
