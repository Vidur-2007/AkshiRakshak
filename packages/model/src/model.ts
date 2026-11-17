import type { Contribution, ModelPrediction, ScamCategory, Span, TextModel } from '@akshi/contracts';
import { featurize } from './featurize';

export const MODEL_FORMAT = 'akshi-lr-v1';
const TOP_CONTRIBUTIONS = 25;
const TOP_CATEGORIES = 5;
/** below this scam probability the category is not reported (SPEC_C_DATA.md §4.4) */
const CATEGORY_MIN_P = 0.4;

/** Shape of packages/model/model/scam-model.json (SPEC_C_DATA.md §4.3). */
export interface ModelJson {
  format: string;
  version: string;
  trainedAt: string;
  features: string[];
  idf: number[];
  scam: { coef: number[]; intercept: number };
  category: { classes: string[]; coef: number[][][]; intercept: number[] };
}

function isNumberArray(v: unknown, length?: number): v is number[] {
  return Array.isArray(v) && (length === undefined || v.length === length) && v.every((x) => typeof x === 'number');
}

/** Checks the exported JSON by hand (no zod in the offline core). Returns null for anything unexpected. */
export function parseModelJson(raw: unknown): ModelJson | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const m = raw as Partial<ModelJson>;
  if (m.format !== MODEL_FORMAT || typeof m.version !== 'string') return null;
  if (!Array.isArray(m.features) || m.features.length === 0) return null;
  const n = m.features.length;
  if (!isNumberArray(m.idf, n)) return null;
  if (!m.scam || !isNumberArray(m.scam.coef, n) || typeof m.scam.intercept !== 'number') return null;
  const c = m.category;
  if (!c || !Array.isArray(c.classes) || c.classes.length === 0) return null;
  if (!isNumberArray(c.intercept, c.classes.length)) return null;
  if (!Array.isArray(c.coef) || c.coef.length !== c.classes.length) return null;
  for (const row of c.coef) {
    if (!Array.isArray(row)) return null;
    for (const pair of row) {
      if (!isNumberArray(pair, 2) || pair[0]! < 0 || pair[0]! >= n) return null;
    }
  }
  return m as ModelJson;
}

function mergeSpans(flat: number[], text: string): Span[] {
  const pairs: [number, number][] = [];
  for (let i = 0; i < flat.length; i += 2) pairs.push([flat[i]!, flat[i + 1]!]);
  pairs.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const merged: [number, number][] = [];
  for (const [start, end] of pairs) {
    const last = merged[merged.length - 1];
    if (last && start < last[1]) last[1] = Math.max(last[1], end);
    else merged.push([start, end]);
  }
  return merged.map(([start, end]) => ({ start, end, text: text.slice(start, end) }));
}

/** Builds the classifier from the exported JSON. Returns null if the JSON is not a model this code understands. */
export function createModel(raw: unknown): TextModel | null {
  const json = parseModelJson(raw);
  if (!json) return null;

  const vocabulary = new Map<string, number>();
  json.features.forEach((f, i) => vocabulary.set(f, i));
  const idf = Float64Array.from(json.idf);
  const scamCoef = Float64Array.from(json.scam.coef);
  const classes = json.category.classes as ScamCategory[];
  const classIntercept = json.category.intercept;
  // feature index → flat [classIndex, weight, …]; only features some class uses
  const byFeature = new Map<number, number[]>();
  json.category.coef.forEach((row, k) => {
    for (const [j, w] of row as [number, number][]) {
      const list = byFeature.get(j);
      if (list) list.push(k, w);
      else byFeature.set(j, [k, w]);
    }
  });

  function predict(text: string): ModelPrediction {
    const { counts, spans } = featurize(text, vocabulary);

    // tf-idf with sublinear tf, L2-normalised over the known features that occur
    const index: number[] = [];
    const x: number[] = [];
    let sumSq = 0;
    for (const [j, count] of counts) {
      const v = (1 + Math.log(count)) * idf[j]!;
      index.push(j);
      x.push(v);
      sumSq += v * v;
    }
    const norm = sumSq > 0 ? Math.sqrt(sumSq) : 1;

    let z = json!.scam.intercept;
    const logits = classIntercept.slice();
    const positive: { j: number; value: number }[] = [];
    for (let i = 0; i < index.length; i++) {
      const j = index[i]!;
      const xj = x[i]! / norm;
      const value = xj * scamCoef[j]!;
      z += value;
      if (value > 0) positive.push({ j, value });
      const cat = byFeature.get(j);
      if (cat) for (let c = 0; c < cat.length; c += 2) logits[cat[c]!]! += xj * cat[c + 1]!;
    }
    const pScam = 1 / (1 + Math.exp(-z));

    const maxLogit = Math.max(...logits);
    const exps = logits.map((l) => Math.exp(l - maxLogit));
    const total = exps.reduce((a, b) => a + b, 0);
    const ranked = exps.map((e, k) => ({ k, p: e / total })).sort((a, b) => b.p - a.p || a.k - b.k);
    const categoryProbs: Partial<Record<ScamCategory, number>> = {};
    for (const { k, p } of ranked.slice(0, TOP_CATEGORIES)) categoryProbs[classes[k]!] = p;

    positive.sort((a, b) => b.value - a.value || a.j - b.j);
    const contributions: Contribution[] = positive.slice(0, TOP_CONTRIBUTIONS).map(({ j, value }) => ({
      feature: json!.features[j]!,
      value,
      spans: mergeSpans(spans.get(j) ?? [], text),
    }));

    return {
      pScam,
      category: pScam >= CATEGORY_MIN_P ? classes[ranked[0]!.k]! : null,
      categoryProbs,
      contributions,
    };
  }

  return { version: json.version, predict };
}
