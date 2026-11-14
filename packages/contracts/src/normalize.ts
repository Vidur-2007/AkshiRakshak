/**
 * normalizeText (SPEC.md §7.1). Used by the engine and the model; C's Python
 * featuriser implements the same steps and a parity test checks both.
 *
 * 1. Unicode NFKC
 * 2. remove U+200B, U+200C, U+200D, U+2060, U+FEFF
 * 3. map Devanagari (U+0966–096F), Bengali (U+09E6–09EF), Telugu (U+0C66–0C6F) digits to ASCII 0–9
 * 4. replace every run of whitespace (JavaScript `\s`) with one space
 * 5. trim
 */
const ZERO_WIDTH = /\u200B|\u200C|\u200D|\u2060|\uFEFF/g; // alternation, not a class: ZWJ inside [] trips no-misleading-character-class
const INDIC_DIGIT = /[\u0966-\u096F\u09E6-\u09EF\u0C66-\u0C6F]/g;
const WHITESPACE_RUN = /\s+/g;

const DIGIT_BASES = [0x0966, 0x09e6, 0x0c66] as const;

function indicDigitToAscii(ch: string): string {
  const code = ch.charCodeAt(0);
  for (const base of DIGIT_BASES) {
    if (code >= base && code <= base + 9) return String(code - base);
  }
  return ch;
}

export function normalizeText(raw: string): string {
  return raw
    .normalize('NFKC')
    .replace(ZERO_WIDTH, '')
    .replace(INDIC_DIGIT, indicDigitToAscii)
    .replace(WHITESPACE_RUN, ' ')
    .trim();
}
