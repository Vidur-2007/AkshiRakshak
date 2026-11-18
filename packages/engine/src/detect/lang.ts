/**
 * Script and language detection (SPEC_A_ENGINE.md §4.1).
 * Counts letters per Unicode block on normalised text.
 */
import type { AnalysisResult } from '@akshi/contracts';

export type Script = 'latn' | 'deva' | 'beng' | 'telu';
export type DetectedLang = AnalysisResult['detectedLang'];

export interface ScriptCounts {
  latn: number;
  deva: number;
  beng: number;
  telu: number;
  /** letters in any other script (Cyrillic, Tamil, …) */
  other: number;
}

const LETTER = /\p{L}/u;

export function countScripts(text: string): ScriptCounts {
  const c: ScriptCounts = { latn: 0, deva: 0, beng: 0, telu: 0, other: 0 };
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp >= 0x0900 && cp <= 0x097f) c.deva++;
    else if (cp >= 0x0980 && cp <= 0x09ff) c.beng++;
    else if (cp >= 0x0c00 && cp <= 0x0c7f) c.telu++;
    else if ((cp >= 0x41 && cp <= 0x5a) || (cp >= 0x61 && cp <= 0x7a)) c.latn++;
    else if (cp >= 0xc0 && LETTER.test(ch)) {
      // Latin-1 / Latin Extended letters count as Latin; everything else is "other"
      if (cp <= 0x024f) c.latn++;
      else c.other++;
    }
  }
  return c;
}

/** Scripts with at least one letter in the text. */
export function scriptsPresent(counts: ScriptCounts): Set<Script> {
  const s = new Set<Script>();
  if (counts.latn > 0) s.add('latn');
  if (counts.deva > 0) s.add('deva');
  if (counts.beng > 0) s.add('beng');
  if (counts.telu > 0) s.add('telu');
  return s;
}

/** Romanised Hindi markers (Hinglish). ≥ 3 hits on Latin text → 'hi'. */
export const HINGLISH_MARKERS = [
  'aapka',
  'aapke',
  'aapki',
  'aap',
  'apka',
  'apke',
  'apki',
  'apna',
  'apne',
  'apni',
  'khata',
  'khate',
  'band',
  'turant',
  'jaldi',
  'abhi',
  'kijiye',
  'kijie',
  'karein',
  'karen',
  'kare',
  'karo',
  'karna',
  'kar',
  'paise',
  'paisa',
  'rupaye',
  'nahi',
  'nahin',
  'hoga',
  'hogi',
  'jayega',
  'jayegi',
  'jaega',
  'jaegi',
  'bhejo',
  'bhejiye',
  'bhej',
  'batao',
  'bataiye',
  'bata',
  'hai',
  'hain',
  'ho',
  'hoon',
  'hu',
  'mein',
  'mai',
  'main',
  'ka',
  'ki',
  'ke',
  'ko',
  'se',
  'aur',
  'yeh',
  'ye',
  'kya',
  'kyun',
  'kripya',
  'dijiye',
  'milega',
  'milegi',
  'mil',
  'liye',
  'wala',
  'wale',
  'raha',
  'rahe',
  'rahi',
  'sakte',
  'saktey',
  'kisi',
  'mat',
  'ji',
] as const;
const MARKER_SET = new Set<string>(HINGLISH_MARKERS);
const LATIN_WORD = /[a-z]+/gi;

export function hinglishHits(text: string): number {
  let hits = 0;
  for (const m of text.matchAll(LATIN_WORD)) if (MARKER_SET.has(m[0].toLowerCase())) hits++;
  return hits;
}

export function detectLang(text: string, counts = countScripts(text)): DetectedLang {
  const indic = { hi: counts.deva, bn: counts.beng, te: counts.telu } as const;
  const total = counts.latn + counts.deva + counts.beng + counts.telu + counts.other;
  if (total === 0) return 'other';
  const share = (n: number) => n / total;

  for (const [lang, n] of Object.entries(indic) as [keyof typeof indic, number][]) {
    if (share(n) >= 0.7) return lang;
  }
  const big = [counts.latn, counts.deva, counts.beng, counts.telu, counts.other].filter(
    (n) => share(n) >= 0.25,
  );
  if (big.length >= 2) return 'mixed';

  const largest = Math.max(counts.latn, counts.deva, counts.beng, counts.telu, counts.other);
  if (largest === counts.latn) return hinglishHits(text) >= 3 ? 'hi' : 'en';
  if (largest === counts.deva) return 'hi';
  if (largest === counts.beng) return 'bn';
  if (largest === counts.telu) return 'te';
  return 'other';
}
