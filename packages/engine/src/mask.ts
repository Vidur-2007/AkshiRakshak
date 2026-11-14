/**
 * maskPII (SPEC_A_ENGINE.md §11). Applied before any text goes to /api/ai/* or /api/ask.
 * P3 adds tests for every pattern and the replacement count shown on the privacy line.
 */
import { UPI_ID_RE } from './extract/entities';
import { inspectUrlLocal } from './links/inspect';

type Rep = string | ((match: string, ...groups: string[]) => string);

const MASKS: [RegExp, Rep][] = [
  [
    /\bhttps?:\/\/[^\s]+|\bwww\.[^\s]+/gi,
    (m) => `https://${inspectUrlLocal(m).registrableDomain}/[PATH]`,
  ],
  [/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+/g, '[EMAIL]'],
  [UPI_ID_RE, '[UPI_ID]'],
  [/\b\d{4}\s?\d{4}\s?\d{4}\b/g, '[ID_NUMBER]'],
  [/\b[A-Z]{5}\d{4}[A-Z]\b/g, '[ID_NUMBER]'],
  [/(?:\+?91[\s-]?)?\b[6-9]\d{4}[\s-]?\d{5}\b|\b18[06]0[\s-]?\d{3}[\s-]?\d{4}\b/g, '[PHONE]'],
  [/\b\d{9,18}\b/g, '[NUMBER]'],
  [/\b(Dear|Mr\.?|Mrs\.?|Ms\.?|Shri|Smt\.?)\s+[A-Z][a-z]+/g, (_m, s = '') => `${s} [NAME]`],
  [/(श्री|प्रिय)\s+[\p{Script=Devanagari}]+/gu, (_m, s = '') => `${s} [NAME]`],
];

export function maskPII(text: string): { masked: string; replacements: number } {
  let replacements = 0;
  let masked = text;
  for (const [re, rep] of MASKS) {
    masked = masked.replace(re, (...args: string[]) => {
      replacements++;
      return typeof rep === 'string' ? rep : rep(args[0] ?? '', ...args.slice(1));
    });
  }
  return { masked, replacements };
}
