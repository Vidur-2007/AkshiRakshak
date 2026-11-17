/**
 * The analyzer of SPEC_C_DATA.md §4.1, a line-for-line port of ml/akshi_ml/featurize.py.
 * It also records where every known feature occurs in the original string (UTF-16 offsets), for highlights.
 *
 * Input must already be normalised with normalizeText from @akshi/contracts.
 */

export const PUNCT = '!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~“”‘’…–—।॥';
const PUNCT_SET = new Set(Array.from(PUNCT));
const MIN_N = 2;
const MAX_N = 5;

export interface Featurized {
  /** feature index → number of occurrences */
  counts: Map<number, number>;
  /** feature index → flat [start, end, start, end, …] UTF-16 offsets into the input */
  spans: Map<number, number[]>;
}

/**
 * Lower-cases code point by code point (as the Python side does) and keeps, for every resulting code point,
 * the UTF-16 range of the source code point it came from.
 */
function lowerWithOffsets(text: string): { cps: string[]; starts: number[]; ends: number[] } {
  const cps: string[] = [];
  const starts: number[] = [];
  const ends: number[] = [];
  let offset = 0;
  for (const cp of text) {
    const end = offset + cp.length;
    const low = cp.toLowerCase();
    if (low.length === 1 || low === cp) {
      cps.push(low);
      starts.push(offset);
      ends.push(end);
    } else {
      for (const part of low) {
        cps.push(part);
        starts.push(offset);
        ends.push(end);
      }
    }
    offset = end;
  }
  return { cps, starts, ends };
}

/** Every feature of the text, in the Python analyzer's order. Used by tests; predict() uses featurize(). */
export function analyze(text: string): string[] {
  const out: string[] = [];
  walk(text, (feature) => out.push(feature));
  return out;
}

export function featurize(text: string, vocabulary: ReadonlyMap<string, number>): Featurized {
  const counts = new Map<number, number>();
  const spans = new Map<number, number[]>();
  walk(text, (feature, start, end) => {
    const index = vocabulary.get(feature);
    if (index === undefined) return;
    counts.set(index, (counts.get(index) ?? 0) + 1);
    const list = spans.get(index);
    if (list) list.push(start, end);
    else spans.set(index, [start, end]);
  });
  return { counts, spans };
}

function walk(text: string, emit: (feature: string, start: number, end: number) => void): void {
  const { cps, starts, ends } = lowerWithOffsets(text);
  const n = cps.length;

  // words: maximal runs of non-space code points, as [from, to)
  const wordFrom: number[] = [];
  const wordTo: number[] = [];
  let i = 0;
  while (i < n) {
    while (i < n && cps[i] === ' ') i++;
    if (i >= n) break;
    const from = i;
    while (i < n && cps[i] !== ' ') i++;
    wordFrom.push(from);
    wordTo.push(i);
  }

  // word tokens: punctuation stripped from both ends
  const tokens: string[] = [];
  const tokenStart: number[] = [];
  const tokenEnd: number[] = [];
  for (let w = 0; w < wordFrom.length; w++) {
    let a = wordFrom[w]!;
    let b = wordTo[w]!;
    while (a < b && PUNCT_SET.has(cps[a]!)) a++;
    while (b > a && PUNCT_SET.has(cps[b - 1]!)) b--;
    if (a === b) continue;
    let token = '';
    for (let k = a; k < b; k++) token += cps[k]!;
    tokens.push(token);
    tokenStart.push(starts[a]!);
    tokenEnd.push(ends[b - 1]!);
  }
  for (let t = 0; t < tokens.length; t++) emit('w:' + tokens[t]!, tokenStart[t]!, tokenEnd[t]!);
  for (let t = 0; t + 1 < tokens.length; t++) {
    emit('w:' + tokens[t]! + ' ' + tokens[t + 1]!, tokenStart[t]!, tokenEnd[t + 1]!);
  }

  // char_wb n-grams over each word padded with one space on both sides (scikit-learn's procedure)
  for (let w = 0; w < wordFrom.length; w++) {
    const from = wordFrom[w]!;
    const len = wordTo[w]! - from;
    const padded = len + 2;
    for (let size = MIN_N; size <= MAX_N; size++) {
      let offset = 0;
      for (;;) {
        // padded index p maps to word index p - 1; p = 0 and p = padded - 1 are the pad spaces
        let gram = '';
        for (let p = offset; p < offset + size && p < padded; p++) {
          gram += p === 0 || p === padded - 1 ? ' ' : cps[from + p - 1]!;
        }
        const first = Math.max(offset, 1) - 1;
        const last = Math.min(offset + size, padded - 1) - 2;
        emit('c:' + gram, starts[from + first]!, ends[from + last]!);
        if (offset + size >= padded) break;
        offset++;
      }
      if (offset === 0) break; // a word shorter than the gram size is counted once
    }
  }
}
