/**
 * Fusion, verdict, severity, confidence and category (SPEC_A_ENGINE.md §8.1–§8.4, SPEC.md §7.3).
 */
import type {
  Calibration,
  Entities,
  LayerContribution,
  ModelPrediction,
  ScamCategory,
  Severity,
  Signal,
  SignalId,
  Verdict,
} from '@akshi/contracts';
import { CATALOG, CATEGORY_CONTEXT, FLOOR_SIGNALS } from '../rules/catalog';

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** §8.1 rules layer: noisy-OR of positive rule weights × (1 + Σ negative weights). */
export function rulesLayerScore(signals: readonly Signal[]): number {
  let keep = 1;
  let negative = 0;
  let floorFired = false;
  for (const s of signals) {
    const e = CATALOG[s.id];
    if (e.floor) floorFired = true;
    if (e.weight > 0 && e.layer === 'rules') keep *= 1 - e.weight;
    else if (e.weight < 0) negative += e.weight;
  }
  let r = 100 * (1 - keep);
  if (!floorFired) r *= 1 + negative;
  return clamp(r, 0, 100);
}

/** Highest floor whose conditions hold (§5.2). */
export function highestFloor(signals: readonly Signal[], maxReports = 0): number {
  const ids = new Set<SignalId>(signals.map((s) => s.id));
  let floor = 0;
  for (const id of ids) {
    if (!FLOOR_SIGNALS.has(id)) continue;
    const f = CATALOG[id].floor;
    if (!f) continue;
    if (f.requiresAny && !f.requiresAny.some((r) => ids.has(r))) continue;
    if (f.minReports !== undefined && maxReports < f.minReports) continue;
    floor = Math.max(floor, f.score);
  }
  return floor;
}

export function verdictOf(score: number, cal: Calibration): Verdict {
  if (score >= cal.thresholds.scam) return 'scam';
  if (score >= cal.thresholds.suspicious) return 'suspicious';
  return 'no_signs';
}

export function severityOf(score: number): Severity {
  if (score >= 85) return 'critical';
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  if (score >= 15) return 'low';
  return 'none';
}

export interface FusionInput {
  signals: readonly Signal[];
  entities: Entities;
  calibration: Calibration;
  useLinks: boolean;
  /** indicators layer score (95 / 60), or null when no indicator matched or the layer is off */
  indicators: number | null;
  maxReports: number;
  /** model layer score 0–100, or null when unavailable */
  model: number | null;
  /** AI likelihood 0–100, or null when not used */
  ai: number | null;
}

export interface FusionResult {
  riskScore: number;
  rules: number;
  floor: number;
  layers: LayerContribution[];
}

/** §8.2 combination. An unflagged link (risk 0) is absence of evidence, so the links layer counts only when L > 0. */
export function fuse(input: FusionInput): FusionResult {
  const { fusion, aiBlend } = input.calibration;
  const rules = rulesLayerScore(input.signals);
  const urlMax = Math.max(0, ...input.entities.urls.map((u) => u.risk));
  const upiMax = Math.max(0, ...input.entities.upiIds.map((u) => u.risk));
  const links = input.useLinks ? Math.max(urlMax, upiMax) : 0;

  const parts: { layer: 'rules' | 'model' | 'links'; w: number; s: number }[] = [
    { layer: 'rules', w: fusion.rules, s: rules },
  ];
  if (input.model !== null) parts.push({ layer: 'model', w: fusion.model, s: input.model });
  if (links > 0) parts.push({ layer: 'links', w: fusion.links, s: links });
  const wSum = parts.reduce((a, p) => a + p.w, 0) || 1;
  const weighted = parts.reduce((a, p) => a + p.w * p.s, 0) / wSum;

  const base = input.indicators !== null ? Math.max(weighted, input.indicators) : weighted;
  let final = input.ai !== null ? (1 - aiBlend) * base + aiBlend * input.ai : base;
  final = Math.min(final, base + 15);
  const floor = highestFloor(input.signals, input.maxReports);
  final = Math.max(final, floor);
  const riskScore = Math.round(clamp(final, 0, 100));

  const share = (contribution: number) =>
    riskScore > 0 ? clamp(contribution / riskScore, 0, 1) : 0;
  const contrib = (layer: string) => {
    const p = parts.find((x) => x.layer === layer);
    return p ? (p.w * p.s) / wSum : 0;
  };
  const linkShare = share(contrib('links'));
  const layers: LayerContribution[] = [
    { layer: 'rules', score: Math.round(rules), share: share(contrib('rules')), available: true },
    {
      layer: 'model',
      score: input.model ?? 0,
      share: share(contrib('model')),
      available: input.model !== null,
    },
    {
      layer: 'links',
      score: urlMax,
      share: urlMax >= upiMax ? linkShare : 0,
      available: input.useLinks && input.entities.urls.length > 0,
    },
    {
      layer: 'upi',
      score: upiMax,
      share: upiMax > urlMax ? linkShare : 0,
      available: input.useLinks && input.entities.upiIds.length > 0,
    },
    {
      layer: 'indicators',
      score: input.indicators ?? 0,
      share: share(Math.max(0, base - weighted)),
      available: input.indicators !== null,
    },
    {
      layer: 'ai',
      score: input.ai ?? 0,
      share: share(Math.max(0, Math.min(final, base + 15) - base)),
      available: input.ai !== null,
    },
  ];
  return { riskScore, rules, floor, layers };
}

/** §8.3 confidence. */
export function confidenceOf(
  signals: readonly Signal[],
  rules: number,
  model: number | null,
  verdict: Verdict,
  textLength: number,
): number {
  const strong = signals.filter((s) => s.weight >= 0.35).length;
  const agreement = model !== null ? 1 - Math.abs(rules - model) / 100 : 0.5;
  let c = clamp(0.55 + 0.1 * Math.min(strong, 3) + 0.15 * agreement, 0.5, 0.98);
  if (verdict === 'no_signs' && textLength < 25) c = Math.min(c, 0.6);
  return Math.round(c * 100) / 100;
}

/** Category hint for one signal, refined by context (CATEGORY_CONTEXT). */
export function categoryHint(
  id: SignalId,
  ids: ReadonlySet<SignalId>,
  text: string,
): ScamCategory | null {
  for (const c of CATEGORY_CONTEXT) {
    if (c.when !== id) continue;
    if (c.withAny?.some((w) => ids.has(w)) || c.textAny?.test(text)) return c.category;
  }
  return CATALOG[id].category;
}

/**
 * §8.4: AI (later) → model (prob ≥ 0.5) → rule hints. Rule hints vote by weight, so several
 * signals that point at the same scam outweigh one generic signal (e.g. OTP ask inside a KYC message).
 */
export function chooseCategory(
  verdict: Verdict,
  signals: readonly Signal[],
  text: string,
  model: ModelPrediction | null,
): { category: ScamCategory | null; confidence: number } {
  if (verdict === 'no_signs') return { category: null, confidence: 0 };
  if (model?.category) {
    const p = model.categoryProbs[model.category] ?? 0;
    if (p >= 0.5) return { category: model.category, confidence: Math.round(p * 100) / 100 };
  }
  const ids = new Set<SignalId>(signals.map((s) => s.id));
  const votes = new Map<ScamCategory, number>();
  let total = 0;
  for (const s of signals) {
    if (s.weight <= 0) continue;
    const c = categoryHint(s.id, ids, text);
    if (!c) continue;
    votes.set(c, (votes.get(c) ?? 0) + s.weight);
    total += s.weight;
  }
  let best: ScamCategory | null = null;
  let bestVotes = 0;
  for (const [c, v] of votes) {
    if (v > bestVotes) {
      best = c;
      bestVotes = v;
    }
  }
  if (!best) return { category: 'other', confidence: 0.3 };
  return { category: best, confidence: Math.round(clamp(bestVotes / total, 0, 1) * 100) / 100 };
}
