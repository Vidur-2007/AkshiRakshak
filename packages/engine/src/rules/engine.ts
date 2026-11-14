/**
 * Rules engine (SPEC_A_ENGINE.md §5). Lexicon phrases and regexes are compiled once per
 * (lexicon, script) group into one matcher per signal, lazily on first use. Only groups whose
 * script appears in the text run; Latin groups (English and romanised Hindi, plus any Latin
 * phrases in te/bn) run whenever the text has Latin letters.
 *
 * Post-processing, in order:
 *  1. negation — "ask" signals inside a negated clause ("do not share your OTP") are dropped;
 *  2. ask spans overlapping SAFETY_ADVICE are dropped;
 *  3. SAFETY_ADVICE is dropped if the message still asks for an OTP, PIN, CVV/password or a remote app;
 *  4. if SAFETY_ADVICE survives, SECRECY spans inside it are dropped ("OTP किसी को न बताएं").
 * OBFUSCATION is detected in code (spaced letters, digit-for-letter swaps, mixed scripts in a word).
 */
import { normalizeText, type Lang, type Signal, type SignalId, type Span } from '@akshi/contracts';
import { countScripts, scriptsPresent, type Script } from '../detect/lang';
import { dedupeSpans, overlaps } from '../extract/entities';
import { signalText } from '../i18n';
import { CATALOG } from './catalog';
import bn from './lexicons/bn.json';
import en from './lexicons/en.json';
import hi from './lexicons/hi.json';
import te from './lexicons/te.json';

export interface LexiconEntry {
  phrases: string[];
  regex: string[];
}
export interface Lexicon {
  lang: string;
  scripts: string[];
  signals: Partial<Record<SignalId, LexiconEntry>>;
}
export const LEXICONS: Readonly<Record<Lang, Lexicon>> = { en, hi, te, bn };

export interface RuleHit {
  id: SignalId;
  spans: Span[];
}

// ───────────── compilation ─────────────

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

export function scriptOfString(s: string): Script {
  if (/\p{Script=Devanagari}/u.test(s)) return 'deva';
  if (/\p{Script=Bengali}/u.test(s)) return 'beng';
  if (/\p{Script=Telugu}/u.test(s)) return 'telu';
  return 'latn';
}

interface Matcher {
  id: SignalId;
  re: RegExp;
}
interface Bucket {
  latin: string[];
  indic: string[];
  regex: string[];
}

function phraseToPattern(p: string, latin: boolean): string {
  const escaped = escapeRe(normalizeText(p).toLowerCase());
  // tolerate curly apostrophes; one space in the lexicon matches one space in normalised text
  return latin ? escaped.replace(/'/g, "['’]") : escaped;
}

function compileGroups(lex: Lexicon): Map<Script, Matcher[]> {
  const buckets = new Map<Script, Map<SignalId, Bucket>>();
  const bucket = (script: Script, id: SignalId): Bucket => {
    let m = buckets.get(script);
    if (!m) buckets.set(script, (m = new Map()));
    let b = m.get(id);
    if (!b) m.set(id, (b = { latin: [], indic: [], regex: [] }));
    return b;
  };
  for (const [id, entry] of Object.entries(lex.signals) as [SignalId, LexiconEntry][]) {
    for (const phrase of entry.phrases) {
      const script = scriptOfString(phrase);
      const b = bucket(script, id);
      if (script === 'latn') b.latin.push(phraseToPattern(phrase, true));
      else b.indic.push(phraseToPattern(phrase, false));
    }
    for (const r of entry.regex) bucket(scriptOfString(r), id).regex.push(normalizeText(r));
  }
  const out = new Map<Script, Matcher[]>();
  for (const [script, m] of buckets) {
    const matchers: Matcher[] = [];
    for (const [id, b] of m) {
      const byLen = (a: string, c: string) => c.length - a.length;
      const parts: string[] = [];
      // Word boundaries per phrase. \b is ASCII-based, which is what Latin phrases need, and lets
      // the matchers run without the (slower) u flag — lexicon patterns are all BMP and use no \p{…}.
      const bounded = (p: string) =>
        `${/^\w/.test(p) ? '\\b' : ''}${p}${/\w$/.test(p) ? '\\b' : ''}`;
      if (b.latin.length)
        parts.push(`(?:${[...new Set(b.latin)].sort(byLen).map(bounded).join('|')})`);
      if (b.indic.length) parts.push(`(?:${[...new Set(b.indic)].sort(byLen).join('|')})`);
      for (const r of b.regex) parts.push(`(?:${r})`);
      matchers.push({ id, re: new RegExp(parts.join('|'), 'gi') });
    }
    out.set(script, matchers);
  }
  return out;
}

const compiled = new Map<Lang, Map<Script, Matcher[]>>();
function groupsFor(lang: Lang): Map<Script, Matcher[]> {
  let g = compiled.get(lang);
  if (!g) compiled.set(lang, (g = compileGroups(LEXICONS[lang])));
  return g;
}

/** Compile every lexicon now (warmup) so the first scoreLive call is fast. */
export function precompileLexicons(): void {
  for (const lang of Object.keys(LEXICONS) as Lang[]) groupsFor(lang);
}

// ───────────── de-obfuscation (length-preserving) ─────────────

const LEET: Readonly<Record<string, string>> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '8': 'b',
  '@': 'a',
  $: 's',
};
const MIXED_TOKEN = /[A-Za-z0-9@$]{3,15}/g;
const MEASURE_LIKE = /^\d+(?:st|nd|rd|th|k|g|gb|mb|hrs?|mins?|am|pm|x|cr|l)$/i;

function isLeetCandidate(tok: string): boolean {
  if (!/[A-Za-z]/.test(tok) || !/[0-9@$]/.test(tok)) return false;
  if ((tok.match(/[A-Za-z]/g) ?? []).length < 2) return false;
  if (MEASURE_LIKE.test(tok) || /@[a-z]{2,}$/i.test(tok)) return false; // 24hrs, 4g, UPI handles
  return true;
}

/** Map digit-for-letter swaps inside mixed tokens (0→o, 1→i, 4→a, @→a…). Same length as input. */
export function deobfuscate(text: string): string {
  return text.replace(MIXED_TOKEN, (tok) =>
    isLeetCandidate(tok) ? tok.replace(/[0-9@$]/g, (c) => LEET[c] ?? c) : tok,
  );
}

// ───────────── OBFUSCATION detection ─────────────

const KEY_WORDS = [
  'otp',
  'kyc',
  'pin',
  'cvv',
  'upi',
  'sbi',
  'hdfc',
  'icici',
  'paytm',
  'bank',
  'refund',
  'account',
  'password',
  'aadhaar',
  'block',
  'blocked',
];
const OBF_TARGETS = new Set([
  ...KEY_WORDS,
  'axis',
  'kotak',
  'phonepe',
  'gpay',
  'googlepay',
  'amazon',
  'flipkart',
  'airtel',
  'jio',
  'yono',
  'lottery',
  'prize',
  'winner',
  'reward',
  'free',
  'cash',
  'money',
  'verify',
  'update',
  'login',
]);
const SEP = '[\\s.*_•·-]+';
const SPACED = new RegExp(
  `(?<![\\p{L}\\p{N}])(?:${KEY_WORDS.map((w) => [...w].join(SEP)).join('|')})(?![\\p{L}\\p{N}])`,
  'giu',
);
const WORD = /[\p{L}\p{M}]+/gu;
const LATN = 1;
const CYRL = 2;
const GREK = 4;
const DEVA = 8;
const BENG = 16;
const TELU = 32;

/** Script bit for a code point (ranges, not \p{Script} regexes — this runs per character). */
function scriptBit(cp: number): number {
  if ((cp >= 0x41 && cp <= 0x5a) || (cp >= 0x61 && cp <= 0x7a) || (cp >= 0xc0 && cp <= 0x24f))
    return LATN;
  if (cp >= 0x400 && cp <= 0x52f) return CYRL;
  if (cp >= 0x370 && cp <= 0x3ff) return GREK;
  if (cp >= 0x900 && cp <= 0x97f) return DEVA;
  if (cp >= 0x980 && cp <= 0x9ff) return BENG;
  if (cp >= 0xc00 && cp <= 0xc7f) return TELU;
  return 0;
}

function mixedScripts(word: string): boolean {
  let bits = 0;
  for (let i = 0; i < word.length; i++) bits |= scriptBit(word.charCodeAt(i));
  const homoglyph = (bits & (CYRL | GREK)) !== 0 && (bits & ~(CYRL | GREK)) !== 0;
  const indic = [DEVA, BENG, TELU].filter((b) => bits & b).length;
  // Latin + Indic in one word is common typing (e.g. "OTPबताएं"); flag homoglyph mixes and Indic+Indic.
  return homoglyph || (bits & CYRL && bits & GREK) !== 0 || indic >= 2;
}

export function detectObfuscation(text: string): Span[] {
  const spans: Span[] = [];
  for (const m of text.matchAll(SPACED)) {
    if (/[\s.*_•·-]/.test(m[0]))
      spans.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
  }
  for (const m of text.matchAll(MIXED_TOKEN)) {
    const tok = m[0];
    if (!isLeetCandidate(tok)) continue;
    const lower = tok.toLowerCase();
    const asI = lower.replace(/[0-9@$]/g, (c) => LEET[c] ?? c);
    const asL = asI.replace(/i/g, (c, i: number) => (lower[i] === '1' ? 'l' : c));
    if (OBF_TARGETS.has(asI) || OBF_TARGETS.has(asL))
      spans.push({ start: m.index, end: m.index + tok.length, text: tok });
  }
  for (const m of text.matchAll(WORD)) {
    if (m[0].length >= 3 && mixedScripts(m[0]))
      spans.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
  }
  return dedupeSpans(spans);
}

// ───────────── negation ─────────────

const ASK_SIGNALS: ReadonlySet<SignalId> = new Set([
  'ASKS_OTP',
  'ASKS_PIN',
  'ASKS_CVV_PASSWORD',
  'ASKS_REMOTE_APP',
  'APK_LINK',
  'RECEIVE_WITH_PIN',
  'QR_TO_RECEIVE',
  'COLLECT_REQUEST',
]);
const CREDENTIAL_ASKS: readonly SignalId[] = [
  'ASKS_OTP',
  'ASKS_PIN',
  'ASKS_CVV_PASSWORD',
  'ASKS_REMOTE_APP',
];
const CLAUSE_BOUNDARY = /[.!?।;|]/;
const NEG_BEFORE = /\b(?:not|never|don['’]?t|dont|won['’]?t|no one|nobody|avoid)\b/i;
const NEG_INSIDE =
  /(?:^|[\s,])(?:न|नहीं|मत|ना|na|nahi|nahin|mat)(?=$|[\s,।.!?])|వద్దు|కండి|కూడదు|ొద్దు|(?:^|\s)না(?=$|[\s,।.!?])/iu;

function clauseBefore(text: string, start: number): string {
  let i = start - 1;
  const min = Math.max(0, start - 40);
  while (i >= min && !CLAUSE_BOUNDARY.test(text[i] ?? '')) i--;
  return text.slice(i + 1, start);
}

export function isNegated(text: string, span: Span): boolean {
  if (NEG_BEFORE.test(clauseBefore(text, span.start))) return true;
  let after = text.slice(span.end, span.end + 8);
  const cut = after.search(CLAUSE_BOUNDARY);
  if (cut >= 0) after = after.slice(0, cut);
  return NEG_INSIDE.test(`${span.text}${after}`);
}

// ───────────── matching ─────────────

/** Raw lexicon matching on normalised text. `scripts` defaults to the scripts present in the text. */
export function matchRules(
  text: string,
  scripts: Set<Script> = scriptsPresent(countScripts(text)),
): RuleHit[] {
  const probe = deobfuscate(text);
  const found = new Map<SignalId, Span[]>();
  for (const lang of Object.keys(LEXICONS) as Lang[]) {
    for (const [script, matchers] of groupsFor(lang)) {
      if (!scripts.has(script)) continue;
      for (const { id, re } of matchers) {
        re.lastIndex = 0;
        for (const m of probe.matchAll(re)) {
          if (m[0].length === 0) continue;
          const span = {
            start: m.index,
            end: m.index + m[0].length,
            text: text.slice(m.index, m.index + m[0].length),
          };
          let list = found.get(id);
          if (!list) found.set(id, (list = []));
          list.push(span);
        }
      }
    }
  }

  // 1. negation on ask-type signals
  for (const id of ASK_SIGNALS) {
    const list = found.get(id);
    if (list)
      found.set(
        id,
        list.filter((s) => !isNegated(text, s)),
      );
  }
  // 2–3. SAFETY_ADVICE vs credential asks
  const safety = found.get('SAFETY_ADVICE') ?? [];
  if (safety.length) {
    for (const id of ASK_SIGNALS) {
      const list = found.get(id);
      if (list)
        found.set(
          id,
          list.filter((s) => !overlaps(s, safety)),
        );
    }
    if (CREDENTIAL_ASKS.some((id) => (found.get(id) ?? []).length > 0))
      found.delete('SAFETY_ADVICE');
  }
  // 4. SECRECY inside surviving safety advice ("OTP किसी को न बताएं")
  const safe = found.get('SAFETY_ADVICE') ?? [];
  const secrecy = found.get('SECRECY');
  if (safe.length && secrecy)
    found.set(
      'SECRECY',
      secrecy.filter((s) => !overlaps(s, safe)),
    );

  const obf = detectObfuscation(text);
  if (obf.length) found.set('OBFUSCATION', obf);

  const hits: RuleHit[] = [];
  for (const [id, spans] of found) {
    const clean = dedupeSpans(spans);
    if (clean.length) hits.push({ id, spans: clean });
  }
  return hits;
}

export function toSignals(
  hits: RuleHit[],
  lang: Lang,
  source: Signal['source'] = 'rule',
): Signal[] {
  return hits
    .map((h) => ({
      id: h.id,
      weight: CATALOG[h.id].weight,
      ...signalText(h.id, lang),
      spans: h.spans,
      source,
    }))
    .sort((a, b) => b.weight - a.weight);
}
