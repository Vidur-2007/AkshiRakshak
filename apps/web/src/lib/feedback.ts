/**
 * "Was Akshi right?" (2026-11-22): the person's own labels for their checks, kept on this device.
 *
 * Labels never change a verdict and never train anything. They are summarised (how often Akshi
 * agreed with you, and where it disagreed in each direction) and can be downloaded as labelled
 * examples, for example to add to a test set. A person's label is their opinion, not verified truth.
 */
import type { FeedbackRecord, ScanRecord } from './db';

/** Akshi "flagged" a check when the verdict was scam or suspicious. */
export const flagged = (f: Pick<FeedbackRecord, 'verdict'>) => f.verdict !== 'no_signs';

export interface FeedbackSummary {
  total: number;
  /** you and Akshi agreed: flagged and you said scam, or not flagged and you said legitimate */
  agreed: number;
  /** Akshi flagged it, you said legitimate (a possible false alarm) */
  falseAlarms: number;
  /** Akshi found no warning signs, you said scam (a possible miss) */
  misses: number;
}

export function summarise(list: readonly FeedbackRecord[]): FeedbackSummary {
  let agreed = 0;
  let falseAlarms = 0;
  let misses = 0;
  for (const f of list) {
    const said = f.label === 'scam';
    if (said === flagged(f)) agreed += 1;
    else if (flagged(f)) falseAlarms += 1;
    else misses += 1;
  }
  return { total: list.length, agreed, falseAlarms, misses };
}

export interface LabelledExample {
  label: 'scam' | 'legit';
  text: string;
  kind: string;
  lang: string;
  akshiVerdict: string;
  akshiRisk: number;
  category: string | null;
  labelledAt: string;
}

/** The labels joined with their checks, for download. Checks that were deleted are left out. */
export function labelledExamples(
  feedback: readonly FeedbackRecord[],
  scans: readonly ScanRecord[],
): LabelledExample[] {
  const byId = new Map(scans.map((s) => [s.id, s]));
  const out: LabelledExample[] = [];
  for (const f of feedback) {
    const scan = byId.get(f.scanId);
    if (!scan) continue;
    out.push({
      label: f.label,
      text: scan.result.text,
      kind: scan.kind,
      lang: scan.result.detectedLang,
      akshiVerdict: f.verdict,
      akshiRisk: f.riskScore,
      category: scan.category,
      labelledAt: f.at,
    });
  }
  return out;
}

/** Save the examples as a JSON file (browser download; nothing leaves the device otherwise). */
export function downloadExamples(examples: readonly LabelledExample[], now = new Date()): void {
  const blob = new Blob([JSON.stringify(examples, null, 2) + '\n'], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `akshi-feedback-${now.toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
