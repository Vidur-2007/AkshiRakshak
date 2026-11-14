/**
 * maskPII (SPEC_A_ENGINE.md §11). Applied before any text goes to /api/ai/* or /api/ask.
 *
 * | pattern                                         | replacement                         |
 * | URLs                                            | https://<registrable domain>/[PATH] |
 * | emails                                          | [EMAIL]                             |
 * | UPI IDs                                         | [UPI_ID]                            |
 * | 16-digit card numbers (spaced or not)           | [NUMBER]                            |
 * | 12-digit groups (Aadhaar-like)                  | [ID_NUMBER]                         |
 * | PAN (AAAAA9999A)                                | [ID_NUMBER]                         |
 * | phone numbers (mobile, +91, 1800/1860)          | [PHONE]                             |
 * | other 9–18 digit runs (accounts, cards)         | [NUMBER]                            |
 * | names after Dear/Mr/Mrs/Ms/Shri/Smt/श्री/प्रिय     | [NAME]                              |
 *
 * Amounts (₹/Rs/INR followed by digits) and brand names are kept: the AI needs them, and they
 * do not identify the user. Order matters: wider patterns run first so a card number is not
 * half-masked as an Aadhaar number, and UPI IDs are masked before their digits look like phones.
 */
import { UPI_ID_RE } from './extract/entities';
import { inspectUrlLocal } from './links/inspect';

type Rep = string | ((match: string, ...groups: string[]) => string);

/** Generic salutation targets that are not names ("Dear Customer"). */
const NOT_NAMES =
  /^(?:customer|customers|sir|madam|user|member|consumer|taxpayer|applicant|friend|valued|account|cardholder|client|team|all)$/i;
const NOT_NAMES_HI = /^(?:ग्राहक|उपभोक्ता|सदस्य|महोदय|महोदया|मित्र)$/u;
/** Not after a currency marker: "Rs 123456789" is an amount, not an account number. */
const NOT_AMOUNT = String.raw`(?<!(?:₹|\b[Rr][Ss]\.?|\bINR)\s?)`;

const MASKS: [RegExp, Rep][] = [
  [
    /\bhttps?:\/\/[^\s<>"']+|\bwww\.[^\s<>"']+/gi,
    (m) => `https://${inspectUrlLocal(m.replace(/[.,;:!?)\]]+$/, '')).registrableDomain}/[PATH]`,
  ],
  [/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,}/g, '[EMAIL]'],
  [UPI_ID_RE, '[UPI_ID]'],
  [new RegExp(`${NOT_AMOUNT}\\b\\d{4}[\\s-]\\d{4}[\\s-]\\d{4}[\\s-]\\d{4}\\b`, 'g'), '[NUMBER]'],
  [
    new RegExp(`${NOT_AMOUNT}\\b\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}\\b(?![\\s-]?\\d)`, 'g'),
    '[ID_NUMBER]',
  ],
  [/\b[A-Z]{5}\d{4}[A-Z]\b/g, '[ID_NUMBER]'],
  [
    /(?<![\d+])(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}(?!\d)|(?<!\d)18[06]0[\s-]?\d{3}[\s-]?\d{4}(?!\d)/g,
    '[PHONE]',
  ],
  [new RegExp(`${NOT_AMOUNT}\\b\\d{9,18}\\b`, 'g'), '[NUMBER]'],
  [
    /\b(Dear|Mr\.?|Mrs\.?|Ms\.?|Shri|Smt\.?)\s+([A-Z][a-z]+)/g,
    (m, s = '', name = '') => (NOT_NAMES.test(name) ? m : `${s} [NAME]`),
  ],
  [
    /(श्री|श्रीमती|प्रिय)\s+(\p{Script=Devanagari}+)/gu,
    (m, s = '', name = '') => (NOT_NAMES_HI.test(name) ? m : `${s} [NAME]`),
  ],
];

export function maskPII(text: string): { masked: string; replacements: number } {
  let replacements = 0;
  let masked = text;
  for (const [re, rep] of MASKS) {
    masked = masked.replace(re, (...args: unknown[]) => {
      const match = String(args[0] ?? '');
      const groups = args.slice(1).filter((a): a is string => typeof a === 'string');
      const out = typeof rep === 'string' ? rep : rep(match, ...groups);
      if (out !== match) replacements++;
      return out;
    });
  }
  return { masked, replacements };
}
