/**
 * Email analysis (SPEC_A_ENGINE.md §9). Parses pasted From / Reply-To / Subject / Return-Path
 * headers and attachment names, then:
 *  - BRAND_MISMATCH: the email claims a brand (display name, subject or body) but the sender
 *    domain is not one of that brand's official domains;
 *  - REPLY_TO_MISMATCH: Reply-To (or Return-Path) is on a different registrable domain than From;
 *  - RISKY_ATTACHMENT: .apk .exe .scr .html .htm attachments, or a .zip named like an invoice/KYC.
 * The body goes through the normal pipeline.
 */
import type { BrandClaim, ClaimCheck, Lang, Signal, SignalId, Span } from '@akshi/contracts';
import { parse } from 'tldts-icann';
import { findBrandClaims } from '../claims/brands';
import { signalText, template } from '../i18n';
import { isOfficialFor } from '../links/inspect';
import { CATALOG } from '../rules/catalog';

export interface EmailHeaders {
  from?: string;
  replyTo?: string;
  subject?: string;
  returnPath?: string;
  attachments: string[];
}

const HEADER = /^(from|reply-to|subject|return-path)\s*:\s*(.*)$/i;
/** File names, not file names inside URL paths ("site.com/a.html") or email addresses. */
const ATTACHMENT =
  /(?<![\w/.@-])[\w()-][\w.()-]{0,80}\.(?:apk|exe|scr|html?|zip|pdf|docx?|xlsx?|js|bat|msi)\b/gi;
const RISKY_EXT = /\.(?:apk|exe|scr|html?|js|bat|msi)$/i;
const RISKY_ZIP = /(?:invoice|kyc|refund|statement|bill|receipt|challan|notice).*\.zip$/i;

export function parseEmailHeaders(raw: string): EmailHeaders {
  const out: EmailHeaders = { attachments: [] };
  for (const line of raw.split(/\r?\n/)) {
    const m = HEADER.exec(line.trim());
    if (!m) continue;
    const key = (m[1] ?? '').toLowerCase();
    const value = (m[2] ?? '').trim();
    if (key === 'from') out.from ??= value;
    else if (key === 'reply-to') out.replyTo ??= value;
    else if (key === 'subject') out.subject ??= value;
    else out.returnPath ??= value;
  }
  out.attachments = [...new Set([...raw.matchAll(ATTACHMENT)].map((m) => m[0]))];
  return out;
}

/** The address inside "Name <a@b.com>", or the bare address. */
export function addressOf(header: string | undefined): string | undefined {
  if (!header) return undefined;
  return (
    /<([^>\s]+@[^>\s]+)>/.exec(header)?.[1] ?? /[^\s<>"]+@[^\s<>"]+/.exec(header)?.[0]
  )?.toLowerCase();
}

/** Registrable domain of an address like "Name <a@b.com>" or "a@b.com". */
export function addressDomain(addr: string | undefined): string | undefined {
  const host = addressOf(addr)?.split('@')[1];
  return host ? (parse(host).domain ?? host) : undefined;
}

function spanOf(text: string, needle: string | undefined): Span | undefined {
  if (!needle) return undefined;
  const i = text.toLowerCase().indexOf(needle.toLowerCase());
  return i >= 0
    ? { start: i, end: i + needle.length, text: text.slice(i, i + needle.length) }
    : undefined;
}

export interface EmailAnalysis {
  headers: EmailHeaders;
  signals: Signal[];
  claims: ClaimCheck[];
  /** brand claims judged against the sender domain (mismatch evidence filled) */
  brands: BrandClaim[];
}

/** `exclude`: spans of URLs, emails and UPI IDs, whose brand tokens are reality, not claims. */
export function analyzeEmail(
  raw: string,
  text: string,
  lang: Lang,
  exclude: readonly Span[] = [],
): EmailAnalysis {
  const headers = parseEmailHeaders(raw);
  const signals: Signal[] = [];
  const claims: ClaimCheck[] = [];
  const brands: BrandClaim[] = [];
  const sig = (id: SignalId, spans: Span[]): Signal => ({
    id,
    weight: CATALOG[id].weight,
    source: 'context',
    ...signalText(id, lang),
    spans,
  });

  const fromAddr = addressOf(headers.from);
  const fromDomain = addressDomain(headers.from);
  const fromSpan = spanOf(text, fromAddr);

  // ── BRAND_MISMATCH: claimed brand vs sender domain ──
  if (fromDomain) {
    const suffix = parse(fromDomain).publicSuffix ?? '';
    const claimsInText = findBrandClaims(text, [...exclude, ...(fromSpan ? [fromSpan] : [])]);
    const seen = new Set<string>();
    for (const h of claimsInText) {
      if (seen.has(h.brand.id)) continue;
      seen.add(h.brand.id);
      const official = isOfficialFor(h.brand, fromDomain, suffix);
      const b: BrandClaim = {
        brand: h.brand.name,
        kind: h.brand.kind,
        span: h.span,
        officialDomains: [...h.brand.domains],
        mismatch: !official,
      };
      if (!official) {
        b.evidence = template('evidenceSender', lang, { domain: fromDomain, brand: h.brand.name });
        signals.push(sig('BRAND_MISMATCH', [h.span, ...(fromSpan ? [fromSpan] : [])]));
        claims.push({
          claim: template('claimBrand', lang, { brand: h.brand.name }),
          reality: h.brand.domains[0]
            ? template('realitySender', lang, { domain: fromDomain, official: h.brand.domains[0] })
            : template('realitySenderUnknown', lang, { domain: fromDomain, brand: h.brand.name }),
          mismatch: true,
          signal: 'BRAND_MISMATCH',
        });
      }
      brands.push(b);
    }
  }

  // ── REPLY_TO_MISMATCH ──
  for (const other of [headers.replyTo, headers.returnPath]) {
    const d = addressDomain(other);
    if (!d || !fromDomain || d === fromDomain) continue;
    const span = spanOf(text, addressOf(other));
    signals.push(sig('REPLY_TO_MISMATCH', span ? [span] : []));
    claims.push({
      claim: template('claimSender', lang, { domain: fromDomain }),
      reality: template('realityReplyTo', lang, { domain: d }),
      mismatch: true,
      signal: 'REPLY_TO_MISMATCH',
    });
    break;
  }

  // ── RISKY_ATTACHMENT ──
  const risky = headers.attachments.filter((a) => RISKY_EXT.test(a) || RISKY_ZIP.test(a));
  if (risky.length) {
    signals.push(
      sig(
        'RISKY_ATTACHMENT',
        risky.flatMap((a) => spanOf(text, a) ?? []),
      ),
    );
  }

  // merge duplicates of the same id
  const merged = new Map<SignalId, Signal>();
  for (const s of signals) {
    const prev = merged.get(s.id);
    if (prev)
      prev.spans.push(...s.spans.filter((x) => !prev.spans.some((p) => p.start === x.start)));
    else merged.set(s.id, s);
  }
  return { headers, signals: [...merged.values()], claims, brands };
}
