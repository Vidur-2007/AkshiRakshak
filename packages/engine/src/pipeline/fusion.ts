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
import { SIGNAL_IDS } from '@akshi/contracts';
import { CATALOG, CATEGORY_CONTEXT, FLOOR_SIGNALS, type FloorContext } from '../rules/catalog';

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** §8.1 rules layer: noisy-OR of positive rule weights × (1 + Σ negative weights). */
export function rulesLayerScore(signals: readonly Signal[]): number {
  let keep = 1;
  let negative = 0;
  let floorFired = false;
  for (const s of signals) {
    const e = CATALOG[s.id];
    if (e.floor) floorFired = true;
    // the signal's own weight (e.g. COLLECT_REQUEST +0.15 for an unknown requester, §6.5)
    if (s.weight > 0 && e.layer === 'rules') keep *= 1 - Math.min(s.weight, 1);
    else if (s.weight < 0) negative += s.weight;
  }
  let r = 100 * (1 - keep);
  if (!floorFired) r *= 1 + negative;
  return clamp(r, 0, 100);
}

export interface FloorOptions {
  maxReports?: number;
  contexts?: ReadonlySet<FloorContext>;
}

/** Highest floor whose conditions hold (§5.2). */
export function highestFloor(signals: readonly Signal[], opts: FloorOptions = {}): number {
  const maxReports = opts.maxReports ?? 0;
  const ids = new Set<SignalId>(signals.map((s) => s.id));
  let floor = 0;
  for (const id of ids) {
    if (!FLOOR_SIGNALS.has(id)) continue;
    const f = CATALOG[id].floor;
    if (!f) continue;
    if (f.requiresAny && !f.requiresAny.some((r) => ids.has(r))) continue;
    if (f.minReports !== undefined && maxReports < f.minReports) continue;
    if (f.requiresContext && !opts.contexts?.has(f.requiresContext)) continue;
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
  /** floor contexts for this message (official claim, bank/govt lookalike) */
  contexts?: ReadonlySet<FloorContext>;
  /** extra floor outside the catalog (collect request "you will receive" → 90, §6.5) */
  extraFloor?: number;
  /**
   * false for single-item inputs (a bare URL, UPI ID or phone, or a QR that only holds a URL):
   * there is no message text for the rules layer to judge, so it is not a relevant layer (§8.2).
   */
  rulesRelevant?: boolean;
}

export interface FusionResult {
  riskScore: number;
  rules: number;
  floor: number;
  layers: LayerContribution[];
}

/** §8.2 combination; the links layer is relevant whenever the message has links or UPI IDs. */
export function fuse(input: FusionInput): FusionResult {
  const { fusion, aiBlend } = input.calibration;
  const rules = rulesLayerScore(input.signals);
  const urlMax = Math.max(0, ...input.entities.urls.map((u) => u.risk));
  const upiMax = Math.max(0, ...input.entities.upiIds.map((u) => u.risk));
  const links = input.useLinks ? Math.max(urlMax, upiMax) : 0;

  const parts: { layer: 'rules' | 'model' | 'links'; w: number; s: number }[] = [];
  const linksRelevant =
    input.useLinks && input.entities.urls.length + input.entities.upiIds.length > 0;
  if (input.rulesRelevant !== false || !linksRelevant)
    parts.push({ layer: 'rules', w: fusion.rules, s: rules });
  if (input.model !== null) parts.push({ layer: 'model', w: fusion.model, s: input.model });
  if (linksRelevant) parts.push({ layer: 'links', w: fusion.links, s: links });
  const wSum = parts.reduce((a, p) => a + p.w, 0) || 1;
  const weighted = parts.reduce((a, p) => a + p.w * p.s, 0) / wSum;

  const base = input.indicators !== null ? Math.max(weighted, input.indicators) : weighted;
  let final = input.ai !== null ? (1 - aiBlend) * base + aiBlend * input.ai : base;
  final = Math.min(final, base + 15);
  const floor = Math.max(
    highestFloor(input.signals, { maxReports: input.maxReports, contexts: input.contexts }),
    input.extraFloor ?? 0,
  );
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

const ORDER = new Map<SignalId, number>(SIGNAL_IDS.map((id, i) => [id, i]));

/**
 * §8.4: AI (P3) → model (category probability ≥ 0.5) → the category hint of the highest-weighted
 * rule signal (refined by CATEGORY_CONTEXT; signals without a hint are skipped). Rules-layer
 * signals come first; link/UPI signals are used only when no rule signal has a hint.
 * Ties go to the signal listed first in SIGNAL_IDS. `no_signs` → null.
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
  const ranked = signals
    .filter((s) => s.weight > 0 && s.id !== 'MODEL_PATTERN' && s.id !== 'AI_FLAG')
    .sort((a, b) => b.weight - a.weight || (ORDER.get(a.id) ?? 0) - (ORDER.get(b.id) ?? 0));
  for (const rulesOnly of [true, false]) {
    for (const s of ranked) {
      if (rulesOnly && CATALOG[s.id].layer !== 'rules') continue;
      const c = categoryHint(s.id, ids, text);
      if (c) return { category: c, confidence: Math.round(clamp(s.weight, 0, 1) * 100) / 100 };
    }
  }
  return { category: 'other', confidence: 0.3 };
}
