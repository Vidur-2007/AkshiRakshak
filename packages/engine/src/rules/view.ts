/**
 * The text the lexicons are matched against (the "matching view"), with disguises undone:
 *
 * 1. Cyrillic and Greek lookalikes folded to Latin, inside words that contain a Latin letter or
 *    consist only of lookalikes ("рауtm", "ОТР").
 * 2. Letters split by separators joined back: "S H A R E", "O.T.P.", "P*I*N", "O🔥T🔥P". Only runs
 *    of three or more single characters with at least two letters, so "I am at a bank" stays.
 * 3. A letter repeated three or more times reduced to one: "shaaare" → "share", "OTPPPP" → "OTP".
 * 4. Digit-for-letter swaps (deobfuscate in engine.ts, applied by the caller): "0TP", "Sh@re".
 *
 * Steps 2 and 3 change the length, so `at[i]` gives the index in the original text of view
 * character i. Spans found in the view map back to the original with `toSpan`, so underlines land
 * on the real characters and `text.slice(start, end) === span.text` still holds.
 */
import type { Span } from '@akshi/contracts';

export interface MatchView {
  view: string;
  /** index in the original text of each view character; null when the view is the same length */
  at: Int32Array | null;
}

const FOLD: Readonly<Record<string, string>> = {
  // Cyrillic
  а: 'a',
  в: 'b',
  е: 'e',
  к: 'k',
  м: 'm',
  н: 'h',
  о: 'o',
  р: 'p',
  с: 'c',
  т: 't',
  у: 'y',
  х: 'x',
  і: 'i',
  ј: 'j',
  ѕ: 's',
  ԁ: 'd',
  ӏ: 'l',
  ԛ: 'q',
  ԝ: 'w',
  А: 'A',
  В: 'B',
  Е: 'E',
  К: 'K',
  М: 'M',
  Н: 'H',
  О: 'O',
  Р: 'P',
  С: 'C',
  Т: 'T',
  У: 'Y',
  Х: 'X',
  І: 'I',
  Ј: 'J',
  Ѕ: 'S',
  // Greek
  α: 'a',
  ε: 'e',
  ι: 'i',
  κ: 'k',
  ν: 'v',
  ο: 'o',
  ρ: 'p',
  τ: 't',
  υ: 'u',
  χ: 'x',
  Α: 'A',
  Β: 'B',
  Ε: 'E',
  Ζ: 'Z',
  Η: 'H',
  Ι: 'I',
  Κ: 'K',
  Μ: 'M',
  Ν: 'N',
  Ο: 'O',
  Ρ: 'P',
  Τ: 'T',
  Υ: 'Y',
  Χ: 'X',
};
const HAS_FOLDABLE = /[Ͱ-ϿЀ-ԯ]/u;
const WORD = /[\p{L}\p{M}]+/gu;

/** Fold lookalikes, word by word. Same length as the input (every mapping is one UTF-16 unit). */
function foldHomoglyphs(text: string): string {
  if (!HAS_FOLDABLE.test(text)) return text;
  return text.replace(WORD, (w) => {
    if (!HAS_FOLDABLE.test(w)) return w;
    const latin = /[A-Za-z]/.test(w);
    const allLookalikes = [...w].every((c) => FOLD[c] !== undefined);
    if (!latin && !allLookalikes) return w; // real Cyrillic or Greek text
    return w.replace(/./gu, (c) => FOLD[c] ?? c);
  });
}

/**
 * Separator between disguised letters: spaces, . * _ • · - ~ | and emoji. Not "/" or "+": "a/c",
 * "w/o" and "A+" are ordinary writing.
 */
const SEP = String.raw`(?:[\s.*_•·\-~|]|\p{Extended_Pictographic}|\u{FE0F})+`;
const UNIT = String.raw`[A-Za-z0-9@$]`;
/** three or more single units split by separators, not touching a longer word on either side */
const SPLIT_RUN = new RegExp(
  // a letter glued to "/" or an apostrophe belongs to a word ("a/c", "don't"), not to the run
  String.raw`(?<![\p{L}\p{N}@$/'’])${UNIT}(?:${SEP}${UNIT}){2,}(?![\p{L}\p{N}@$/'’])`,
  'gu',
);
const REPEAT = /([A-Za-z])\1{2,}/g;

interface Edit {
  start: number;
  end: number;
  /** offsets inside [start, end) whose characters are kept, in order */
  keep: number[];
  /** text put in place of the edit, before the kept characters (" | " between windows) */
  insert?: string;
  /** indexes into `keep` before which a space is inserted (word breaks found by segmenting) */
  spaceBefore?: ReadonlySet<number>;
}

/** Known words, lower case: splits a fully spaced-out phrase ("S H A R E Y O U R O T P"). */
export type Vocabulary = ReadonlySet<string>;

/**
 * Split a run of letters into known words, fewest words first. Returns the break positions, or
 * null when the run is one known word or cannot be split completely into known words.
 */
export function segment(word: string, vocab: Vocabulary): number[] | null {
  const w = word.toLowerCase();
  if (w.length < 5 || vocab.has(w) || w.length > 60) return null;
  // best[i] = fewest words covering w[0, i); prev[i] = where the last word starts
  const best = new Array<number>(w.length + 1).fill(Infinity);
  const prev = new Array<number>(w.length + 1).fill(-1);
  best[0] = 0;
  for (let i = 1; i <= w.length; i++) {
    for (let j = Math.max(0, i - 20); j < i; j++) {
      if (best[j]! + 1 < best[i]! && vocab.has(w.slice(j, i))) {
        best[i] = best[j]! + 1;
        prev[i] = j;
      }
    }
  }
  if (!Number.isFinite(best[w.length]!) || best[w.length]! < 2) return null;
  const cuts: number[] = [];
  for (let i = prev[w.length]!; i > 0; i = prev[i]!) cuts.unshift(i);
  return cuts;
}

function splitRunEdits(text: string, vocab?: Vocabulary): Edit[] {
  const edits: Edit[] = [];
  for (const m of text.matchAll(SPLIT_RUN)) {
    const units: number[] = [];
    for (let i = 0; i < m[0].length; i++) if (/[A-Za-z0-9@$]/.test(m[0][i]!)) units.push(i);
    if (units.filter((i) => /[A-Za-z]/.test(m[0][i]!)).length < 2) continue; // "1 2 3", "a 1 2"
    let end = m.index + m[0].length;
    // "O.T.P." — the abbreviation's own final dot goes too, so "your O.T.P. with" reads "your OTP with"
    const dotsOnly = /^[A-Za-z0-9@$](?:\.[A-Za-z0-9@$])+$/.test(m[0]);
    if (dotsOnly && text[end] === '.' && !/[\p{L}\p{N}]/u.test(text[end + 1] ?? '')) end++;
    const cuts = vocab ? segment(units.map((i) => m[0][i]).join(''), vocab) : null;
    edits.push({
      start: m.index,
      end,
      keep: units,
      ...(cuts ? { spaceBefore: new Set(cuts) } : {}),
    });
  }
  return edits;
}

/** Letters repeated three or more times, reduced to `keep` copies (1: "shaaare"; 2: "CVVVV"). */
function repeatEdits(text: string, keep: 1 | 2): Edit[] {
  return [...text.matchAll(REPEAT)].map((m) => ({
    start: m.index,
    end: m.index + m[0].length,
    keep: keep === 1 ? [0] : [0, 1],
  }));
}

/**
 * Apply non-overlapping edits (sorted by start), composing with an existing index map. Unchanged
 * stretches are copied as slices and their indexes filled in bulk: views are built for every
 * scan, chat turn and live keystroke, on texts up to 50 KB.
 */
function applyEdits(src: MatchView, edits: Edit[]): MatchView {
  if (!edits.length) return src;
  const { view, at } = src;
  const parts: string[] = [];
  const map = new Int32Array(view.length * 2 + edits.length * 3 + 8);
  let n = 0;
  const copy = (from: number, to: number) => {
    if (to <= from) return;
    parts.push(view.slice(from, to));
    if (at) map.set(at.subarray(from, to), n);
    else for (let i = from; i < to; i++) map[n + i - from] = i;
    n += to - from;
  };
  const put = (ch: string, origin: number) => {
    parts.push(ch);
    map[n++] = origin;
  };
  let pos = 0;
  for (const e of edits) {
    if (e.start < pos) continue;
    copy(pos, e.start);
    const originOf = (i: number) =>
      at ? at[Math.min(i, view.length - 1)]! : Math.min(i, view.length - 1);
    for (const ch of e.insert ?? '') put(ch, originOf(e.start));
    e.keep.forEach((k, idx) => {
      const origin = originOf(e.start + k);
      if (e.spaceBefore?.has(idx)) put(' ', origin);
      put(view[e.start + k]!, origin);
    });
    pos = e.end;
  }
  copy(pos, view.length);
  return { view: parts.join(''), at: map.slice(0, n) };
}

/** Half-width of the window kept around each repeat for the double-letter reading. */
const REPEAT_WINDOW = 16;

/** Homoglyphs folded and split letters joined; repeats not yet reduced. */
function baseView(text: string, vocab?: Vocabulary): MatchView {
  return applyEdits({ view: foldHomoglyphs(text), at: null }, splitRunEdits(text, vocab));
}

/**
 * The matching view of normalised text (before digit-for-letter swaps).
 *
 * A letter repeated three or more times is reduced to one ("shaaare" → "share"). The real word may
 * have a double letter ("CVVVV" is "CVV"), so the words around each repeat are also appended after
 * " | " with repeats reduced to two. One string keeps it to one lexicon pass per call: views are
 * built for every scan, chat turn and live keystroke.
 */
export function matchingView(text: string, vocab?: Vocabulary): MatchView {
  const v = baseView(text, vocab);
  const repeats = repeatEdits(v.view, 1);
  if (!repeats.length) return v;
  const t = v.view;
  const windows: [number, number][] = [];
  for (const r of repeats) {
    let ws = Math.max(0, r.start - REPEAT_WINDOW);
    let we = Math.min(t.length, r.end + REPEAT_WINDOW);
    while (ws > 0 && !/\s/.test(t[ws - 1]!)) ws--; // whole words only
    while (we < t.length && !/\s/.test(t[we]!)) we++;
    const last = windows.at(-1);
    if (last && ws <= last[1]) last[1] = Math.max(last[1], we);
    else windows.push([ws, we]);
  }
  const twos = repeatEdits(t, 2);
  const edits: Edit[] = [];
  let pos = 0;
  for (const [ws, we] of windows) {
    if (ws > pos) edits.push({ start: pos, end: ws, keep: [], insert: pos === 0 ? '' : ' | ' });
    for (const r of twos) if (r.start >= ws && r.end <= we) edits.push(r);
    pos = we;
  }
  if (pos < t.length) edits.push({ start: pos, end: t.length, keep: [] });
  const ones = applyEdits(v, repeats);
  const doubles = applyEdits(v, edits);
  const at = new Int32Array(ones.view.length + 3 + doubles.view.length);
  at.set(ones.at!, 0);
  at.fill(ones.at![ones.view.length - 1] ?? 0, ones.view.length, ones.view.length + 3);
  at.set(doubles.at!, ones.view.length + 3);
  return { view: `${ones.view} | ${doubles.view}`, at };
}

/** The text with disguises undone and digit swaps applied by `swap`: for the model (plain text). */
export function undisguised(text: string, swap: (s: string) => string, vocab?: Vocabulary): string {
  const v = baseView(text, vocab);
  return swap(applyEdits(v, repeatEdits(v.view, 1)).view);
}

/** Map a match at [start, end) in the view back to a span of the original text. */
export function toSpan(text: string, v: MatchView, start: number, end: number): Span {
  const s = v.at ? v.at[start]! : start;
  const e = v.at ? v.at[end - 1]! + 1 : end;
  return { start: s, end: e, text: text.slice(s, e) };
}
