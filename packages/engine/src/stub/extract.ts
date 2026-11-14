/**
 * Phase 0 stub helpers: keyword signals, simple entity extraction, UPI URI parsing.
 * Spans are real offsets into the normalised text. Replaced in P1/P2.
 */
import type {
  AmountFinding,
  Entities,
  IndicatorMatch,
  PhoneFinding,
  ScamCategory,
  Signal,
  SignalId,
  Span,
  UpiIdFinding,
  UpiPayload,
  UrlFinding,
} from '@akshi/contracts';
import { INDICATORS } from '@akshi/content';
import { SIGNAL_TEXT } from './strings';

// ───────────── keywords (SPEC_A_ENGINE.md §2.3) ─────────────

interface Keyword {
  re: RegExp;
  id: SignalId;
  weight: number;
  category: ScamCategory;
}

const KEYWORDS: Keyword[] = [
  { re: /\botp\b/gi, id: 'ASKS_OTP', weight: 0.35, category: 'otp_theft' },
  { re: /\bk\.?y\.?c\b/gi, id: 'BANK_IMPERSONATION', weight: 0.2, category: 'fake_kyc' },
  { re: /\bblock(?:ed)?\b/gi, id: 'THREAT_BLOCK', weight: 0.25, category: 'fake_kyc' },
  { re: /\bpin\b/gi, id: 'ASKS_PIN', weight: 0.55, category: 'upi_collect' },
  { re: /\brefund\b/gi, id: 'WRONG_TRANSFER_RETURN', weight: 0.4, category: 'refund_cashback' },
  { re: /\blottery\b/gi, id: 'PRIZE_LOTTERY', weight: 0.35, category: 'lottery_prize' },
  { re: /\barrest\b/gi, id: 'THREAT_LEGAL', weight: 0.3, category: 'digital_arrest' },
  { re: /\bapk\b/gi, id: 'APK_LINK', weight: 0.55, category: 'malicious_apk' },
  { re: /\bhttps?:\/\/\S+/gi, id: 'SUSPICIOUS_LINK', weight: 0.2, category: 'phishing_link' },
  { re: /\bupi\b/gi, id: 'COLLECT_REQUEST', weight: 0.2, category: 'upi_collect' },
];

const SAFETY_RE = /\b(?:do not|don't|never) share\b[^.]{0,40}/gi;

function spansOf(text: string, re: RegExp): Span[] {
  const out: Span[] = [];
  for (const m of text.matchAll(re)) {
    out.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
  }
  return out;
}

export interface KeywordHits {
  signals: Signal[];
  categories: ScamCategory[];
  /** distinct keyword signals that raise risk */
  count: number;
}

export function keywordSignals(text: string): KeywordHits {
  const signals: Signal[] = [];
  const categories: ScamCategory[] = [];
  const safety = spansOf(text, SAFETY_RE);
  for (const k of KEYWORDS) {
    // A genuine "do not share your OTP" message mentions OTP without asking for it.
    if (k.id === 'ASKS_OTP' && safety.length > 0) continue;
    const spans = spansOf(text, k.re);
    if (spans.length === 0) continue;
    signals.push({ id: k.id, weight: k.weight, source: 'rule', spans, ...SIGNAL_TEXT[k.id] });
    categories.push(k.category);
  }
  const count = signals.length;
  if (safety.length > 0 && count === 0) {
    signals.push({
      id: 'SAFETY_ADVICE',
      weight: -0.3,
      source: 'rule',
      spans: safety,
      ...SIGNAL_TEXT.SAFETY_ADVICE,
    });
  }
  signals.sort((a, b) => b.weight - a.weight);
  return { signals, categories, count };
}

// ───────────── indicators ─────────────

function canonicalPhone(value: string): string | null {
  const digits = value.replace(/\D/g, '');
  if (/^[6-9]\d{9}$/.test(digits)) return `+91${digits}`;
  if (/^91[6-9]\d{9}$/.test(digits)) return `+${digits}`;
  return null;
}

export function lookupIndicatorStub(value: string): IndicatorMatch | null {
  const v = value.trim().toLowerCase();
  const phone = canonicalPhone(v);
  const hit = INDICATORS.find(
    (i) => i.value.toLowerCase() === v || (phone !== null && i.value === phone),
  );
  if (!hit) return null;
  const match: IndicatorMatch = {
    value: hit.value,
    type: hit.type,
    reports: hit.reports,
    category: hit.category,
    source: 'bundled',
    sampleData: true,
  };
  if (hit.campaign) match.campaign = hit.campaign;
  return match;
}

// ───────────── URLs ─────────────

const SHORTENERS = new Set([
  'bit.ly',
  'tinyurl.com',
  't.co',
  'cutt.ly',
  'rb.gy',
  'is.gd',
  'v.gd',
  'shorturl.at',
  'tiny.cc',
  'ow.ly',
  's.id',
  'rebrand.ly',
  't.ly',
  'bitly.com',
]);
const SECOND_LEVEL = /^(?:co|gov|nic|org|net|ac|bank|edu|res|firm|gen|ind)\.in$/;

export function urlFinding(raw: string, span?: Span): UrlFinding {
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `http://${raw}`;
  let host: string;
  let normalized = withScheme;
  try {
    const u = new URL(withScheme);
    host = u.hostname.toLowerCase();
    normalized = u.href;
  } catch {
    host = raw.toLowerCase();
  }
  const labels = host.split('.').filter(Boolean);
  const lastTwo = labels.slice(-2).join('.');
  const registrableDomain = SECOND_LEVEL.test(lastTwo) ? labels.slice(-3).join('.') : lastTwo;
  const isShortener = SHORTENERS.has(registrableDomain);
  const isApk = /\.apk(?:$|[?#])/i.test(normalized);
  const indicator = lookupIndicatorStub(registrableDomain);
  const flags: SignalId[] = ['SUSPICIOUS_LINK'];
  if (isShortener) flags.push('SHORTENED_URL');
  if (isApk) flags.push('APK_LINK');
  if (indicator) flags.push('KNOWN_INDICATOR');
  const finding: UrlFinding = {
    raw,
    normalized,
    host,
    registrableDomain,
    tld: labels.at(-1) ?? '',
    risk: indicator ? 85 : isApk ? 80 : isShortener ? 45 : 40,
    flags,
    isOfficial: false,
    isShortener,
    isApk,
  };
  if (span) finding.span = span;
  return finding;
}

// ───────────── UPI IDs ─────────────

export const UPI_ID_RE = /[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z][a-zA-Z0-9]{1,63}(?![a-zA-Z0-9.-])/g;
const UPI_ID_FULL = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z][a-zA-Z0-9]{1,63}$/;

const PSP: Record<string, string> = {
  ybl: 'PhonePe',
  ibl: 'PhonePe',
  axl: 'PhonePe',
  okaxis: 'Google Pay',
  okhdfcbank: 'Google Pay',
  okicici: 'Google Pay',
  oksbi: 'Google Pay',
  paytm: 'Paytm',
  ptyes: 'Paytm',
  ptaxis: 'Paytm',
  pthdfc: 'Paytm',
  ptsbi: 'Paytm',
  apl: 'Amazon Pay',
  yapl: 'Amazon Pay',
  rapl: 'Amazon Pay',
  upi: 'BHIM',
  sbi: 'SBI',
  hdfcbank: 'HDFC Bank',
  icici: 'ICICI Bank',
  axisbank: 'Axis Bank',
  kotak: 'Kotak',
};

export function upiFinding(raw: string, span?: Span): UpiIdFinding {
  const [local = '', handle = ''] = raw.split('@');
  const h = handle.toLowerCase();
  const psp = PSP[h];
  const looksPersonal =
    /^[6-9]\d{9}$/.test(local) ||
    !/(merchant|paytmqr|bharatpe|\.rzp|pay\.|store|shop|mart|q\d{8,})/i.test(local);
  const indicator = lookupIndicatorStub(raw);
  const flags: SignalId[] = [];
  if (indicator) flags.push('KNOWN_INDICATOR');
  const finding: UpiIdFinding = {
    raw,
    handle: h,
    psp: psp ?? 'unknown',
    pspKnown: psp !== undefined,
    looksPersonal,
    risk: indicator ? 85 : psp ? 20 : 35,
    flags,
  };
  if (span) finding.span = span;
  if (indicator) finding.indicator = indicator;
  return finding;
}

// ───────────── entities ─────────────

const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"']+/gi;
const EMAIL_RE = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const PHONE_RE =
  /(?<![\d@.])(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}(?![\d@])|(?<!\d)18[06]0[\s-]?\d{3}[\s-]?\d{4}(?!\d)/g;
const AMOUNT_RE = /(?:₹|\bRs\.?|\bINR)\s?(\d{1,3}(?:,\d{2,3})+(?:\.\d+)?|\d+(?:\.\d+)?)/gi;
const APK_RE = /\S*\.apk\b/gi;

function overlaps(a: Span, list: Span[]): boolean {
  return list.some((b) => a.start < b.end && b.start < a.end);
}

export function extractEntities(text: string): Entities {
  const urls: UrlFinding[] = [];
  const urlSpans: Span[] = [];
  for (const s of spansOf(text, URL_RE)) {
    const trimmed = s.text.replace(/[.,;:!?)\]}]+$/, '');
    const span = { start: s.start, end: s.start + trimmed.length, text: trimmed };
    urlSpans.push(span);
    urls.push(urlFinding(trimmed, span));
  }
  const emailSpans = spansOf(text, EMAIL_RE).filter((s) => !overlaps(s, urlSpans));
  const upiSpans = spansOf(text, UPI_ID_RE).filter(
    (s) => !overlaps(s, urlSpans) && !overlaps(s, emailSpans),
  );
  const taken = [...urlSpans, ...emailSpans, ...upiSpans];
  const phones: PhoneFinding[] = spansOf(text, PHONE_RE)
    .filter((s) => !overlaps(s, taken))
    .map((s) => {
      const p: PhoneFinding = { raw: s.text, span: s, claimedAs: 'unknown' };
      const e164 = canonicalPhone(s.text);
      if (e164) p.e164 = e164;
      const indicator = lookupIndicatorStub(s.text);
      if (indicator) p.indicator = indicator;
      return p;
    });
  const amounts: AmountFinding[] = [];
  for (const m of text.matchAll(AMOUNT_RE)) {
    const span = { start: m.index, end: m.index + m[0].length, text: m[0] };
    if (overlaps(span, taken)) continue;
    amounts.push({
      raw: m[0],
      span,
      value: Number((m[1] ?? '0').replace(/,/g, '')),
      currency: 'INR',
    });
  }
  return {
    urls,
    upiIds: upiSpans.map((s) => upiFinding(s.text, s)),
    phones,
    amounts,
    emails: emailSpans.map((s) => s.text),
    apkMentions: spansOf(text, APK_RE),
    brands: [],
  };
}

// ───────────── UPI URI ─────────────

const KNOWN_PARAMS = new Set([
  'pa',
  'pn',
  'am',
  'cu',
  'tn',
  'mc',
  'tr',
  'url',
  'mode',
  'tid',
  'mam',
  'orgid',
  'sign',
  'purpose',
]);

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

export function parseUpiUriStub(raw: string): UpiPayload {
  const issues: string[] = [];
  const out: UpiPayload = { raw, valid: false, issues };
  const m = /^upi:\/\/([a-z]+)\/?\?(.*)$/is.exec(raw.trim());
  if (!m) {
    issues.push('Not a upi:// payment link');
    return out;
  }
  const action = (m[1] ?? '').toLowerCase();
  if (action !== 'pay') issues.push(`Unusual UPI action "${action}"`);
  for (const part of (m[2] ?? '').split('&')) {
    if (!part) continue;
    const eq = part.indexOf('=');
    const key = (eq < 0 ? part : part.slice(0, eq)).toLowerCase();
    const value = safeDecode(eq < 0 ? '' : part.slice(eq + 1));
    if (!KNOWN_PARAMS.has(key)) {
      issues.push(`Unknown parameter "${key}"`);
      continue;
    }
    if (key === 'am') {
      const n = Number(value);
      if (value !== '' && Number.isFinite(n) && n >= 0) out.am = n;
      else issues.push('Malformed amount');
    } else if (
      key === 'pa' ||
      key === 'pn' ||
      key === 'cu' ||
      key === 'tn' ||
      key === 'mc' ||
      key === 'tr' ||
      key === 'url' ||
      key === 'mode'
    ) {
      out[key] = value;
    }
  }
  if (!out.pa) issues.push('Missing payee UPI ID (pa)');
  else if (!UPI_ID_FULL.test(out.pa)) issues.push('Payee UPI ID is not valid');
  out.valid = action === 'pay' && out.pa !== undefined && UPI_ID_FULL.test(out.pa);
  return out;
}
