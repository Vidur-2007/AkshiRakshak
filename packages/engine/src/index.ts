/**
 * @akshi/engine — public API (SPEC.md §6.5). Isomorphic: no DOM APIs here.
 */
import {
  HealthResponseSchema,
  normalizeText,
  type AnalysisResult,
  type AnalyzeRequest,
  type StageTiming,
  type UrlFinding,
} from '@akshi/contracts';
import { inspectUrlLocal } from './links/inspect';
import { getModel } from './model';
import { getJson } from './net';
import { analyzeRequest } from './pipeline/analyze';
import { precompileLexicons } from './rules/engine';

export { ENGINE_VERSION } from './version';
export { setApiBase } from './net';
export { scoreLive } from './pipeline/live';
export { detectInputKind } from './detect/kind';
export { parseUpiUri } from './upi/uri';
export { maskPII } from './mask';
export { lookupIndicator } from './indicators';
export { askAssistant } from './assistant';
export { signalText, categoryText, actionText, stageText } from './i18n';

export function analyze(
  req: AnalyzeRequest,
  onStage?: (s: StageTiming) => void,
): Promise<AnalysisResult> {
  return analyzeRequest(req, onStage);
}

/** P1: local checks only. P2 adds official domains and lookalikes; network extras follow (§6.2). */
export async function inspectUrl(
  url: string,
  _opts?: { expand?: boolean; domainAge?: boolean; signal?: AbortSignal },
): Promise<UrlFinding> {
  return inspectUrlLocal(normalizeText(url));
}

/** Loads the model and compiles the lexicons. */
export async function warmup(): Promise<void> {
  precompileLexicons();
  await getModel();
}

export async function apiHealth(): Promise<{ online: boolean; ai: boolean }> {
  const res = HealthResponseSchema.safeParse(await getJson('/api/health', { timeoutMs: 2000 }));
  if (!res.success) return { online: false, ai: false };
  return { online: true, ai: res.data.ai.groq || res.data.ai.gemini };
}
