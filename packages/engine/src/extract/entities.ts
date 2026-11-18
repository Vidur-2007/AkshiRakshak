/**
 * Entity extraction (SPEC_A_ENGINE.md §4.3). Input must be normalised text;
 * every span is a UTF-16 offset into it.
 */
import {
  normalizeText,
  type AmountFinding,
  type Entities,
  type PhoneFinding,
  type Span,
  type UpiIdFinding,
} from '@akshi/contracts';
import { parse } from 'tldts-icann';
import { inspectUrlLocal } from '../links/inspect';
import { looksPersonal, pspOf } from '../upi/handles';

// ───────────── shared helpers ─────────────

export function spansOf(text: string, re: RegExp): Span[] {
  const out: Span[] = [];
  for (const m of text.matchAll(re))
    out.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
  return out;
}

export function overlaps(
  a: { start: number; end: number },
  list: readonly { start: number; end: number }[],
): boolean {
  return list.some((b) => a.start < b.end && b.start < a.end);
}

/** Keep the longest of overlapping spans; result sorted by start. */
export function dedupeSpans<T extends Span>(spans: T[]): T[] {
  const sorted = [...spans].sort(
    (a, b) => b.end - b.start - (a.end - a.start) || a.start - b.start,
  );
  const kept: T[] = [];
  for (const s of sorted) if (!overlaps(s, kept)) kept.push(s);
  return kept.sort((a, b) => a.start - b.start);
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
/** Alternation of normalised words, longest first (so "लाख" beats "ला"). */
function alt(words: string[]): string {
  return [...new Set(words.map((w) => normalizeText(w)))]
    .sort((a, b) => b.length - a.length)
    .map(escapeRe)
    .join('|');
}

// ───────────── URLs ─────────────

const SCHEME_URL = /\b(?:https?:\/\/|www\.)[^\s<>"'`]+/gi;
const BARE_DOMAIN =
  /(?<![\p{L}\p{N}@._/-])[a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)+(?:\/[^\s<>"'`]*)?/giu;
const TRAILING_PUNCT = /[.,;:!?)\]}'"]+$/;

function trimUrl(s: Span): Span {
  let text = s.text.replace(TRAILING_PUNCT, '');
  // keep a closing bracket that has its opener inside the URL
  if (s.text.length > text.length && s.text[text.length] === ')' && text.includes('(')) text += ')';
  return { start: s.start, end: s.start + text.length, text };
}

function isRealDomain(host: string): boolean {
  const p = parse(host);
  if (p.isIp) return false;
  if (p.isIcann !== true || !p.domain || !p.publicSuffix) return false;
  return !/^\d+$/.test(p.publicSuffix) && /[a-z]/i.test(p.domainWithoutSuffix ?? '');
}

function extractUrlSpans(text: string, exclude: Span[]): Span[] {
  const scheme = spansOf(text, SCHEME_URL).map(trimUrl);
  const bare = spansOf(text, BARE_DOMAIN)
    .map(trimUrl)
    .filter((s) => !overlaps(s, scheme) && !overlaps(s, exclude))
    .filter((s) => isRealDomain((s.text.split('/')[0] ?? '').toLowerCase()));
  return dedupeSpans([...scheme.filter((s) => !overlaps(s, exclude)), ...bare]);
}

// ───────────── UPI IDs and emails ─────────────

/** UPI ID: the part after '@' has no dot (otherwise it is an email). */
export const UPI_ID_RE =
  // a "." right after the handle may end the sentence ("…to daily.task.reward@ibl. All members");
  // only a dot followed by a letter or digit (name@gmail.com) makes it an email domain instead
  /(?<![a-zA-Z0-9.\-_])[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z][a-zA-Z0-9]{1,63}(?![a-zA-Z0-9-]|\.[a-zA-Z0-9])/g;
export const UPI_ID_FULL = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z][a-zA-Z0-9]{1,63}$/;
const EMAIL_RE =
  /(?<![a-zA-Z0-9._%+-])[a-zA-Z0-9._%+-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,}(?![a-zA-Z0-9-])/g;

export function upiIdFinding(raw: string, span?: Span): UpiIdFinding {
  const at = raw.lastIndexOf('@');
  const local = raw.slice(0, at);
  const handle = raw.slice(at + 1).toLowerCase();
  const psp = pspOf(handle);
  const finding: UpiIdFinding = {
    raw,
    handle,
    psp: psp ?? 'unknown',
    pspKnown: psp !== undefined,
    looksPersonal: looksPersonal(local),
    risk: psp ? 0 : 10, // unknown handles: small risk, never decisive (P2 adds brand checks)
    flags: [],
  };
  if (span) finding.span = span;
  return finding;
}

// ───────────── phones ─────────────

const PHONE_RE =
  /(?<![\d+])(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}(?!\d)|(?<!\d)18[06]0[\s-]?\d{3}[\s-]?\d{4}(?!\d)/g;

const CLAIM_WORDS: [NonNullable<PhoneFinding['claimedAs']>, RegExp][] = [
  [
    'customer_care',
    new RegExp(
      alt([
        'customer care',
        'customer-care',
        'customer service',
        'customer support',
        'helpline',
        'help line',
        'help desk',
        'helpdesk',
        'toll free',
        'toll-free',
        'support team',
        'care number',
        'कस्टमर केयर',
        'ग्राहक सेवा',
        'हेल्पलाइन',
        'कस्टमर सपोर्ट',
        'कस्टमर केअर',
        'కస్టమర్ కేర్',
        'హెల్ప్ లైన్',
        'హెల్ప్లైన్',
        'వినియోగదారుల సేవ',
        'কাস্টমার কেয়ার',
        'হেল্পলাইন',
        'গ্রাহক পরিষেবা',
      ]),
      'iu',
    ),
  ],
  [
    'police',
    new RegExp(
      alt([
        'police',
        'officer',
        'inspector',
        'cbi',
        'cyber cell',
        'cyber crime',
        'crime branch',
        'narcotics',
        'ncb',
        ' ed ',
        'enforcement directorate',
        'पुलिस',
        'अधिकारी',
        'इंस्पेक्टर',
        'साइबर सेल',
        'पोलिस',
        'పోలీసు',
        'పోలీస్',
        'అధికారి',
        'ఇన్స్పెక్టర్',
        'পুলিশ',
        'অফিসার',
        'ইন্সপেক্টর',
        'আধিকারিক',
      ]),
      'iu',
    ),
  ],
  [
    'courier',
    new RegExp(
      alt([
        'courier',
        'parcel',
        'delivery',
        'shipment',
        'fedex',
        'dtdc',
        'blue dart',
        'bluedart',
        'delhivery',
        'india post',
        'customs',
        'कूरियर',
        'कुरियर',
        'पार्सल',
        'डिलीवरी',
        'కొరియర్',
        'పార్సెల్',
        'డెలివరీ',
        'কুরিয়ার',
        'পার্সেল',
        'ডেলিভারি',
      ]),
      'iu',
    ),
  ],
  [
    'bank',
    new RegExp(
      alt([
        'bank',
        'branch manager',
        'sbi',
        'hdfc',
        'icici',
        'axis',
        'kotak',
        'बैंक',
        'బ్యాంక్',
        'బ్యాంకు',
        'ব্যাংক',
        'ব্যাঙ্ক',
      ]),
      'iu',
    ),
  ],
];

function claimedAs(text: string, s: Span): NonNullable<PhoneFinding['claimedAs']> {
  const near = ` ${text.slice(Math.max(0, s.start - 60), s.start)} ${text.slice(s.end, s.end + 25)} `;
  for (const [kind, re] of CLAIM_WORDS) if (re.test(near)) return kind;
  return 'unknown';
}

function e164(raw: string): string | undefined {
  const d = raw.replace(/\D/g, '');
  if (/^[6-9]\d{9}$/.test(d)) return `+91${d}`;
  if (/^91[6-9]\d{9}$/.test(d)) return `+${d}`;
  return undefined;
}

// ───────────── amounts ─────────────

const NUM = String.raw`\d{1,3}(?:,\d{2,3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?`;
const PRE_LATIN = String.raw`(?<![\p{L}])(?:rs|inr)\.?`;
const PRE_INDIC = alt(['रु.', 'रु', 'రూ.', 'రూ']);
const MULT_K = String.raw`k(?![\p{L}])`;
const MULT_BIG_LATIN = String.raw`(?:lakhs?|lacs?|lakh|crores?|cr)(?![\p{L}])`;
const MULT_BIG_INDIC = alt([
  'लाख',
  'करोड़',
  'करोड',
  'లక్షలు',
  'లక్ష',
  'కోట్లు',
  'కోటి',
  'লাখ',
  'লক্ষ',
  'কোটি',
]);
const SUF_LATIN = String.raw`(?:rupees?|rupaye|rupay|rs\.?)(?![\p{L}])|\/-`;
const SUF_INDIC = alt([
  'रुपये',
  'रुपए',
  'रूपये',
  'रुपया',
  'रुपयों',
  'रु',
  'రూపాయలు',
  'రూపాయి',
  'రూ',
  'টাকা',
  'টাকার',
]);

const MULT = `(?:${MULT_K}|${MULT_BIG_LATIN}|${MULT_BIG_INDIC})`;
const MULT_BIG = `(?:${MULT_BIG_LATIN}|${MULT_BIG_INDIC})`;
const AMOUNT_PREFIX = new RegExp(
  `(?:₹|${PRE_LATIN}|${PRE_INDIC})\\s?(${NUM})(?:\\s?(${MULT}))?`,
  'giu',
);
const AMOUNT_SUFFIX = new RegExp(
  `(?<![\\d.,])(${NUM})(?:\\s?(${MULT}))?\\s?(?:${SUF_LATIN}|${SUF_INDIC})`,
  'giu',
);
const AMOUNT_BIG = new RegExp(`(?<![\\d.,])(${NUM})\\s?(${MULT_BIG})`, 'giu');

function multiplier(m: string | undefined): number {
  if (!m) return 1;
  const w = m.toLowerCase();
  if (w === 'k') return 1_000;
  if (
    /^(?:crores?|cr)$/.test(w) ||
    ['करोड', normalizeText('करोड़'), 'కోట్లు', 'కోటి', 'কোটি'].includes(w)
  )
    return 10_000_000;
  return 100_000; // lakh / lac / लाख / లక్ష / লাখ
}

function extractAmounts(text: string, exclude: Span[]): AmountFinding[] {
  const found: (Span & { value: number })[] = [];
  for (const re of [AMOUNT_PREFIX, AMOUNT_SUFFIX, AMOUNT_BIG]) {
    for (const m of text.matchAll(re)) {
      const span = { start: m.index, end: m.index + m[0].length, text: m[0] };
      if (overlaps(span, exclude)) continue;
      const value = Number((m[1] ?? '0').replace(/,/g, '')) * multiplier(m[2]);
      if (Number.isFinite(value)) found.push({ ...span, value });
    }
  }
  return dedupeSpans(found).map(({ value, ...span }) => ({
    raw: span.text,
    span,
    value: Math.round(value * 100) / 100,
    currency: 'INR' as const,
  }));
}

// ───────────── APK mentions (file names; phrases come from the APK_LINK lexicon) ─────────────

const APK_TOKEN = /[^\s"'<>]*\.apk(?![\p{L}\p{N}])/giu;

// ───────────── main ─────────────

export function extractEntities(text: string): Entities {
  const emailSpans = spansOf(text, EMAIL_RE);
  const urlSpans = extractUrlSpans(text, emailSpans);
  const upiSpans = spansOf(text, UPI_ID_RE).filter(
    (s) =>
      !overlaps(s, emailSpans) &&
      !overlaps(
        s,
        urlSpans.filter((u) => /^https?:/i.test(u.text)),
      ),
  );
  const taken = [...urlSpans, ...emailSpans, ...upiSpans];

  const phones: PhoneFinding[] = spansOf(text, PHONE_RE)
    .filter((s) => !overlaps(s, taken))
    .map((s) => {
      const p: PhoneFinding = { raw: s.text, span: s, claimedAs: claimedAs(text, s) };
      const e = e164(s.text);
      if (e) p.e164 = e;
      return p;
    });
  const phoneSpans = phones.flatMap((p) => (p.span ? [p.span] : []));

  return {
    urls: urlSpans.map((s) => inspectUrlLocal(s.text, s)),
    upiIds: upiSpans.map((s) => upiIdFinding(s.text, s)),
    phones,
    amounts: extractAmounts(text, [...taken, ...phoneSpans]),
    emails: emailSpans.map((s) => s.text),
    apkMentions: spansOf(text, APK_TOKEN),
    brands: [], // P2: claims/brands.ts
  };
}
