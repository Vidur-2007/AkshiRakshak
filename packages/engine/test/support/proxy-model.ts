/**
 * A stand-in for C's text model with the same cost profile (SPEC_C_DATA.md §4.1, §4.4): word
 * unigrams + bigrams and char_wb 2–5 grams over code points, 20,000 known features in a Map,
 * TF-IDF with L2 norm, logistic scam score, sparse category logits, top-25 contributions with
 * spans. Weights are deterministic pseudo-random values — only the timing is meaningful.
 * Used by the analyze() benchmark until C's real model is on the branch.
 */
import {
  SCAM_CATEGORIES,
  type ModelPrediction,
  type ScamCategory,
  type TextModel,
} from '@akshi/contracts';

const PUNCT = new Set(Array.from('!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~“”‘’…–—।॥'));

interface Gram {
  f: string;
  start: number;
  end: number;
}

function stripPunct(tok: string, start: number): { tok: string; start: number } {
  const cps = Array.from(tok);
  let a = 0;
  let b = cps.length;
  while (a < b && PUNCT.has(cps[a]!)) a++;
  while (b > a && PUNCT.has(cps[b - 1]!)) b--;
  const lead = cps.slice(0, a).join('').length;
  return { tok: cps.slice(a, b).join(''), start: start + lead };
}

/** §4.1 featuriser with UTF-16 spans into the (lower-cased) text. */
export function featurise(text: string): Gram[] {
  const t = text.toLowerCase();
  const out: Gram[] = [];
  const words: { w: string; start: number }[] = [];
  for (const m of t.matchAll(/\S+/g)) words.push({ w: m[0], start: m.index });

  const toks = words.map(({ w, start }) => stripPunct(w, start)).filter((x) => x.tok.length > 0);
  toks.forEach((x, i) => {
    out.push({ f: `w:${x.tok}`, start: x.start, end: x.start + x.tok.length });
    const nx = toks[i + 1];
    if (nx) out.push({ f: `w:${x.tok} ${nx.tok}`, start: x.start, end: nx.start + nx.tok.length });
  });

  for (const { w, start } of words) {
    const cps = Array.from(` ${w} `);
    // UTF-16 offset of each code point within the padded word (the pad is 1 unit)
    const off: number[] = [];
    let u = start - 1;
    for (const c of cps) {
      off.push(u);
      u += c.length;
    }
    off.push(u);
    for (let n = 2; n <= 5; n++) {
      let o = 0;
      const emit = () => {
        const s = Math.max(start, off[o]!);
        const e = Math.min(start + w.length, off[Math.min(o + n, cps.length)]!);
        out.push({ f: `c:${cps.slice(o, o + n).join('')}`, start: s, end: Math.max(s, e) });
      };
      emit();
      while (o + n < cps.length) {
        o++;
        emit();
      }
      if (o === 0) break;
    }
  }
  return out;
}

/** Deterministic hash → [0, 1). */
function rand(s: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return ((h >>> 0) % 100_000) / 100_000;
}

/** Builds a proxy model whose vocabulary is the most frequent features of `texts` (max 20,000). */
export function proxyModel(texts: readonly string[], maxFeatures = 20_000): TextModel {
  const freq = new Map<string, number>();
  for (const t of texts) for (const g of featurise(t)) freq.set(g.f, (freq.get(g.f) ?? 0) + 1);
  const vocab = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxFeatures)
    .map(([f]) => f);
  const index = new Map(vocab.map((f, i) => [f, i]));
  const idf = vocab.map((f) => 1 + 4 * rand(f, 1));
  const coef = vocab.map((f) => 2 * rand(f, 2) - 1);
  const classes = SCAM_CATEGORIES.filter((c) => c !== 'other').slice(0, 12) as ScamCategory[];
  // sparse category matrix: 300 entries per class
  const catCoef = classes.map((c, k) =>
    vocab
      .filter((f) => rand(f, 10 + k) < 300 / vocab.length)
      .map((f) => [index.get(f)!, 2 * rand(f, 30 + k) - 1] as const),
  );

  return {
    version: 'proxy-bench',
    predict(text: string): ModelPrediction {
      const counts = new Map<number, { n: number; spans: { start: number; end: number }[] }>();
      for (const g of featurise(text)) {
        const j = index.get(g.f);
        if (j === undefined) continue;
        const e = counts.get(j) ?? { n: 0, spans: [] };
        e.n++;
        e.spans.push({ start: g.start, end: g.end });
        counts.set(j, e);
      }
      const x = new Map<number, number>();
      let norm = 0;
      for (const [j, e] of counts) {
        const v = (1 + Math.log(e.n)) * idf[j]!;
        x.set(j, v);
        norm += v * v;
      }
      norm = Math.sqrt(norm) || 1;
      let z = -0.5;
      const contrib: { j: number; value: number }[] = [];
      for (const [j, v] of x) {
        const value = (v / norm) * coef[j]!;
        z += value;
        if (value > 0) contrib.push({ j, value });
      }
      const pScam = 1 / (1 + Math.exp(-z));
      const logits = catCoef.map((row) =>
        row.reduce((a, [j, w]) => a + ((x.get(j) ?? 0) / norm) * w, -1),
      );
      const mx = Math.max(...logits);
      const ex = logits.map((l) => Math.exp(l - mx));
      const sum = ex.reduce((a, b) => a + b, 0);
      const probs = ex.map((e) => e / sum);
      const order = probs.map((p, k) => [p, k] as const).sort((a, b) => b[0] - a[0]);
      const categoryProbs: Partial<Record<ScamCategory, number>> = {};
      for (const [p, k] of order.slice(0, 5)) categoryProbs[classes[k]!] = p;
      contrib.sort((a, b) => b.value - a.value);
      return {
        pScam,
        category: pScam >= 0.4 ? classes[order[0]![1]]! : null,
        categoryProbs,
        contributions: contrib.slice(0, 25).map(({ j, value }) => ({
          feature: vocab[j]!,
          value,
          spans: counts.get(j)!.spans.map((s) => ({ ...s, text: text.slice(s.start, s.end) })),
        })),
      };
    },
  };
}
