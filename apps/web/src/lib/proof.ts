/**
 * Proof page helpers (§5.13). The report is shown exactly as Laptop C's eval
 * harness wrote it; while it is the Phase 0 placeholder, the UI says so.
 */
import type { EvalReport } from './engine';

/** True while EVAL_REPORT is the invented Phase 0 fixture (its notes say PLACEHOLDER). */
export function isPlaceholderReport(r: Pick<EvalReport, 'notes'>): boolean {
  return r.notes.some((n) => /placeholder|not measured|invented/i.test(n));
}

export const CONFIG_ORDER: EvalReport['configs'][number]['name'][] = [
  'rules_only',
  'rules_model',
  'full_no_ai',
  'full_ai_sample',
];

export function orderedConfigs(r: EvalReport): EvalReport['configs'] {
  return [...r.configs].sort((a, b) => CONFIG_ORDER.indexOf(a.name) - CONFIG_ORDER.indexOf(b.name));
}

export function pct(v: number, digits = 0): string {
  return `${(Math.max(0, Math.min(1, v)) * 100).toFixed(digits)}%`;
}

/** Heatmap cell intensity: share of the row (true label) that went to this prediction. */
export function rowShares(matrix: number[][]): number[][] {
  return matrix.map((row) => {
    const sum = row.reduce((a, b) => a + b, 0);
    return row.map((v) => (sum > 0 ? v / sum : 0));
  });
}
