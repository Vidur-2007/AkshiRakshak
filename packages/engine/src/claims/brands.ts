/**
 * Brand claims and claims-vs-reality (SPEC_A_ENGINE.md §8.5).
 *
 * A message "claims" a brand when it names it (four languages), or when a UPI ID's local part
 * carries a brand token ("sbi.refund.desk@ybl"), or the QR payee name / collect requester name
 * names it. The claim is then compared with reality:
 *  - links: a link that is not official for the claimed brand and not owned by another known
 *    brand → BRAND_MISMATCH;
 *  - UPI IDs: a personal UPI ID presented as the brand → UPI_NAME_MISMATCH + PERSONAL_UPI_HANDLE;
 *  - phones: a bank/government/utility/courier/telecom claim that asks you to call a personal
 *    mobile number, together with a threat or pressure → BRAND_MISMATCH.
 * Also: SUSPICIOUS_LINK for non-official links in a financial message, OFFICIAL_DOMAIN when every
 * link is official for the claimed brand, and lookalike claims for links that imitate a brand.
 */
import {
  normalizeText,
  type BrandClaim,
  type ClaimCheck,
  type Entities,
  type Lang,
  type Signal,
  type SignalId,
  type Span,
  type UpiIdFinding,
} from '@akshi/contracts';
import { overlaps } from '../extract/entities';
import { signalText, template } from '../i18n';
import { inspectUrlLocal, rescoreUrl, urlMeta } from '../links/inspect';
import { BRANDS, type Brand } from '../links/registry';
import { CATALOG, type FloorContext } from '../rules/catalog';
import { noisyOrRisk } from '../links/inspect';

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

interface Matcher {
  brand: Brand;
  re: RegExp;
}
let matchers: Matcher[] | null = null;
function brandMatchers(): Matcher[] {
  matchers ??= BRANDS.map((brand) => {
    const latin: string[] = [];
    const indic: string[] = [];
    for (const c of brand.claims) {
      const n = escapeRe(normalizeText(c).toLowerCase());
      (/[a-z0-9]/i.test(c) && !/[^\x20-\x7e]/.test(c) ? latin : indic).push(n);
    }
    const parts: string[] = [];
    if (latin.length)
      parts.push(`\\b(?:${latin.sort((a, b) => b.length - a.length).join('|')})\\b`);
    if (indic.length) parts.push(`(?:${indic.sort((a, b) => b.length - a.length).join('|')})`);
    return { brand, re: new RegExp(parts.join('|'), 'gi') };
  });
  return matchers;
}

export interface ClaimHit {
  brand: Brand;
  span: Span;
}

/** Brand names in the text, outside URLs, emails and UPI IDs (those are the "reality" side). */
export function findBrandClaims(text: string, exclude: readonly Span[] = []): ClaimHit[] {
  const hits: ClaimHit[] = [];
  for (const { brand, re } of brandMatchers()) {
    for (const m of text.matchAll(re)) {
      const span = { start: m.index, end: m.index + m[0].length, text: m[0] };
      if (!overlaps(span, exclude)) hits.push({ brand, span });
    }
  }
  return hits.sort((a, b) => a.span.start - b.span.start);
}

/** Brands whose tokens appear in a UPI ID's local part ("sbi.refund.desk", "hdfc-kyc"). */
export function brandsInLocalPart(local: string): Brand[] {
  const parts = local
    .toLowerCase()
    .split(/[._\-\d]+/)
    .filter(Boolean);
  const joined = parts.join('');
  return BRANDS.filter((b) =>
    b.tokens.some((t) => t && (parts.includes(t) || (t.length >= 5 && joined.includes(t)))),
  );
}

/** Requester / payee names that present an institution without naming a brand. */
const INSTITUTIONAL =
  /\b(?:refund|cashback|reward|support|help ?desk|customer care|official|government|govt|police|cyber ?cell|kyc|bank|desk|department|lottery|prize)\b|रिफंड|कस्टमर केयर|सरकार|पुलिस|बैंक|రీఫండ్|బ్యాంక్|ప్రభుత్వ|రివార్డ్|রিফান্ড|ব্যাংক|সরকার/iu;

const FINANCIAL_SIGNALS: ReadonlySet<SignalId> = new Set([
  'THREAT_BLOCK',
  'THREAT_LEGAL',
  'ASKS_OTP',
  'ASKS_PIN',
  'ASKS_CVV_PASSWORD',
  'ASKS_REMOTE_APP',
  'APK_LINK',
  'RECEIVE_WITH_PIN',
  'COLLECT_REQUEST',
  'QR_TO_RECEIVE',
  'ADVANCE_FEE',
  'PRIZE_LOTTERY',
  'TOO_GOOD_RETURNS',
  'TASK_JOB_PAYMENT',
  'WRONG_TRANSFER_RETURN',
  'CUSTOMER_CARE_NUMBER',
  'BANK_IMPERSONATION',
]);
const PRESSURE: readonly SignalId[] = [
  'THREAT_BLOCK',
  'THREAT_LEGAL',
  'URGENCY',
  'CUSTOMER_CARE_NUMBER',
];
const PHONE_CLAIM_KINDS: ReadonlySet<Brand['kind']> = new Set([
  'bank',
  'govt',
  'utility',
  'courier',
  'telecom',
]);

export interface IdentityInput {
  text: string;
  entities: Entities;
  /** rule-layer signals found so far (patterns stage) */
  ruleSignals: readonly Signal[];
  lang: Lang;
  /** QR `pn` or collect requester name, presented as the owner of `payeeUpi` */
  payeeName?: string;
  payeeUpi?: string;
}

export interface IdentityResult {
  brands: BrandClaim[];
  signals: Signal[];
  claims: ClaimCheck[];
  contexts: Set<FloorContext>;
}

const amountText = (n: number) => `₹${n.toLocaleString('en-IN')}`;
export { amountText };

/** Re-inspect URLs so that `isOfficial` reflects the brands this message claims. */
export function reinspectForClaims(entities: Entities, claimed: readonly Brand[]): void {
  if (!claimed.length) return;
  entities.urls = entities.urls.map((u) => {
    const fresh = inspectUrlLocal(u.raw, u.span, { claimed });
    // keep network results if any were attached already
    if (u.expanded) fresh.expanded = u.expanded;
    if (u.domainAge) fresh.domainAge = u.domainAge;
    for (const f of u.flags)
      if (!fresh.flags.includes(f) && f !== 'OFFICIAL_DOMAIN') fresh.flags.push(f);
    rescoreUrl(fresh);
    return fresh;
  });
}

function upiLocal(u: UpiIdFinding): string {
  return u.raw.slice(0, u.raw.lastIndexOf('@'));
}

export function analyzeIdentity(input: IdentityInput): IdentityResult {
  const { text, entities, lang } = input;
  const exclude = [
    ...entities.urls.flatMap((u) => (u.span ? [u.span] : [])),
    ...entities.upiIds.flatMap((u) => (u.span ? [u.span] : [])),
    ...entities.emails.flatMap((e) => {
      const i = text.indexOf(e);
      return i >= 0 ? [{ start: i, end: i + e.length, text: e }] : [];
    }),
  ];
  const hits = findBrandClaims(text, exclude);
  const payeeHits = input.payeeName ? findBrandClaims(normalizeText(input.payeeName)) : [];

  // claimed brands: text mentions, payee names, brand tokens inside UPI local parts
  const claimed = new Map<string, { brand: Brand; span?: Span }>();
  for (const h of hits)
    if (!claimed.has(h.brand.id)) claimed.set(h.brand.id, { brand: h.brand, span: h.span });
  for (const h of payeeHits)
    if (!claimed.has(h.brand.id)) claimed.set(h.brand.id, { brand: h.brand });
  for (const u of entities.upiIds) {
    for (const b of brandsInLocalPart(upiLocal(u)))
      if (!claimed.has(b.id)) claimed.set(b.id, { brand: b, ...(u.span ? { span: u.span } : {}) });
  }
  const claimedBrands = [...claimed.values()].map((c) => c.brand);
  reinspectForClaims(entities, claimedBrands);

  const ruleIds = new Set(input.ruleSignals.map((s) => s.id));
  const signals: Signal[] = [];
  const claims: ClaimCheck[] = [];
  const contexts = new Set<FloorContext>();
  const mismatchSpans: Span[] = [];
  const brandMismatch = new Map<string, string>(); // brand id → evidence
  const push = (id: SignalId, spans: Span[], weight = CATALOG[id].weight) => {
    const prev = signals.find((s) => s.id === id);
    if (prev)
      prev.spans.push(
        ...spans.filter((s) => !prev.spans.some((p) => p.start === s.start && p.end === s.end)),
      );
    else
      signals.push({
        id,
        weight,
        source: id === 'UPI_NAME_MISMATCH' || id === 'PERSONAL_UPI_HANDLE' ? 'upi' : 'url',
        ...signalText(id, lang),
        spans: [...spans],
      });
  };

  // ── links vs claims ──
  for (const { brand, span } of claimed.values()) {
    for (const u of entities.urls) {
      if (u.isOfficial) continue;
      const meta = urlMeta(u);
      if (meta?.owner) continue; // owned by another well-known brand (e.g. play.google.com), not phishing
      const official = brand.domains[0];
      const reality = official
        ? template('realityLink', lang, { domain: u.registrableDomain, official })
        : template('realityLinkUnknown', lang, { domain: u.registrableDomain, brand: brand.name });
      const withAge =
        u.domainAge?.ageDays !== undefined
          ? template('realityLinkAge', lang, { reality, days: String(u.domainAge.ageDays) })
          : reality;
      claims.push({
        claim: template('claimBrand', lang, { brand: brand.name }),
        reality: withAge,
        mismatch: true,
        signal: 'BRAND_MISMATCH',
      });
      brandMismatch.set(
        brand.id,
        template('evidenceLink', lang, { domain: u.registrableDomain, brand: brand.name }),
      );
      mismatchSpans.push(...(span ? [span] : []), ...(u.span ? [u.span] : []));
      if (!u.flags.includes('BRAND_MISMATCH')) u.flags.push('BRAND_MISMATCH');
      rescoreUrl(u);
      break; // one claim entry per brand is enough
    }
  }
  if (mismatchSpans.length) push('BRAND_MISMATCH', mismatchSpans);

  // ── UPI IDs presented as a brand or an institution ──
  const institutionalPayee = input.payeeName ? INSTITUTIONAL.test(input.payeeName) : false;
  for (const u of entities.upiIds) {
    if (!u.looksPersonal || !u.span) continue;
    const local = upiLocal(u);
    const localBrands = brandsInLocalPart(local);
    const nearClaim = hits.find(
      (h) => h.span.end <= u.span!.start && u.span!.start - h.span.end <= 30,
    );
    const isPayee =
      input.payeeUpi !== undefined && input.payeeUpi.toLowerCase() === u.raw.toLowerCase();
    const payeeClaim = isPayee && (payeeHits.length > 0 || institutionalPayee);
    if (!localBrands.length && !nearClaim && !payeeClaim) continue;
    const brand = localBrands[0] ?? nearClaim?.brand ?? payeeHits[0]?.brand;
    const own =
      brand?.upiHandles?.includes(u.handle) && brand.kind === 'bank' && !/^\d{10}$/.test(local);
    if (own) continue; // a bank's own handle with a non-mobile local part is not a personal ID
    push('UPI_NAME_MISMATCH', [...(nearClaim ? [nearClaim.span] : []), u.span]);
    push('PERSONAL_UPI_HANDLE', [u.span]);
    for (const f of ['UPI_NAME_MISMATCH', 'PERSONAL_UPI_HANDLE'] as const)
      if (!u.flags.includes(f)) u.flags.push(f);
    u.risk = Math.max(u.risk, noisyOrRisk(u.flags));
    if (brand) brandMismatch.set(brand.id, template('evidenceUpi', lang, { upi: u.raw }));
    if (isPayee && input.payeeName) {
      const name = input.payeeName;
      claims.push({
        claim: template(
          payeeHits.length || institutionalPayee ? 'claimRequester' : 'claimPayeeName',
          lang,
          { name },
        ),
        reality: template('realityRequesterPersonal', lang, { upi: u.raw }),
        mismatch: true,
        signal: 'UPI_NAME_MISMATCH',
      });
    } else if (brand) {
      claims.push({
        claim: template('claimBrand', lang, { brand: brand.name }),
        reality: template('realityUpiPersonal', lang, { upi: u.raw }),
        mismatch: true,
        signal: 'UPI_NAME_MISMATCH',
      });
    }
  }

  // ── official claim + personal mobile number + pressure ──
  const pressured = PRESSURE.some((id) => ruleIds.has(id));
  if (pressured) {
    const mobiles = entities.phones.filter((p) => p.e164 && p.span);
    for (const { brand, span } of claimed.values()) {
      if (!PHONE_CLAIM_KINDS.has(brand.kind) || !mobiles.length || brandMismatch.has(brand.id))
        continue;
      const phone = mobiles[0]!;
      push('BRAND_MISMATCH', [...(span ? [span] : []), phone.span!]);
      brandMismatch.set(brand.id, template('evidencePhone', lang, { phone: phone.raw }));
      claims.push({
        claim: template('claimBrand', lang, { brand: brand.name }),
        reality: template('realityPhonePersonal', lang, { phone: phone.raw }),
        mismatch: true,
        signal: 'BRAND_MISMATCH',
      });
    }
  }

  // ── links that imitate a brand the text does not name ──
  for (const u of entities.urls) {
    const imitates = urlMeta(u)?.imitates;
    if (!imitates || !u.flags.includes('LOOKALIKE_DOMAIN')) continue;
    if (imitates.kind === 'bank' || imitates.kind === 'govt')
      contexts.add('bank_or_govt_lookalike');
    if (claimed.has(imitates.id)) continue; // already covered by the brand claim above
    claims.push({
      claim: template('claimLookalike', lang, { brand: imitates.name }),
      reality: template('realityLookalike', lang, {
        domain: u.host,
        official: u.lookalikeOf ?? imitates.domains[0] ?? '',
      }),
      mismatch: true,
      signal: 'LOOKALIKE_DOMAIN',
    });
  }

  // ── SUSPICIOUS_LINK: non-official links in a financial message ──
  const financial =
    claimed.size > 0 ||
    input.ruleSignals.some((s) => FINANCIAL_SIGNALS.has(s.id)) ||
    entities.amounts.length > 0;
  if (financial) {
    const spans: Span[] = [];
    for (const u of entities.urls) {
      if (u.isOfficial || urlMeta(u)?.owner) continue;
      if (!u.flags.includes('SUSPICIOUS_LINK')) u.flags.push('SUSPICIOUS_LINK');
      rescoreUrl(u);
      if (u.span) spans.push(u.span);
    }
    if (spans.length) push('SUSPICIOUS_LINK', spans);
  }

  // ── OFFICIAL_DOMAIN: every link is official for the claimed brand ──
  if (claimed.size && entities.urls.length && entities.urls.every((u) => u.isOfficial)) {
    push(
      'OFFICIAL_DOMAIN',
      entities.urls.flatMap((u) => (u.span ? [u.span] : [])),
    );
  }

  // ── floor context: official claim ──
  if (
    [...claimed.values()].some(
      (c) => c.brand.kind === 'bank' || c.brand.kind === 'govt' || c.brand.kind === 'utility',
    ) ||
    ruleIds.has('BANK_IMPERSONATION') ||
    ruleIds.has('AUTHORITY_CLAIM')
  ) {
    contexts.add('official_claim');
  }

  const brands: BrandClaim[] = [...claimed.values()].map(({ brand, span }) => {
    const evidence = brandMismatch.get(brand.id);
    const b: BrandClaim = {
      brand: brand.name,
      kind: brand.kind,
      officialDomains: [...brand.domains],
      mismatch: evidence !== undefined,
    };
    if (span) b.span = span;
    if (evidence) b.evidence = evidence;
    return b;
  });
  return { brands, signals, claims, contexts };
}

/** Floor context for scoreLive (no entities): brand names or official-claim signals. */
export function liveContexts(text: string, ruleSignals: readonly Signal[]): Set<FloorContext> {
  const ctx = new Set<FloorContext>();
  const ids = new Set(ruleSignals.map((s) => s.id));
  if (
    ids.has('BANK_IMPERSONATION') ||
    ids.has('AUTHORITY_CLAIM') ||
    findBrandClaims(text).some((h) => ['bank', 'govt', 'utility'].includes(h.brand.kind))
  ) {
    ctx.add('official_claim');
  }
  return ctx;
}
