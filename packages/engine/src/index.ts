/**
 * @akshi/engine — public API (SPEC.md §6.5). Isomorphic: no DOM APIs here.
 */
import {
  normalizeText,
  type AnalysisResult,
  type AnalyzeRequest,
  type Lang,
  type StageTiming,
  type UrlFinding,
} from '@akshi/contracts';
import { inspectUrlLocal, inspectUrlNetwork } from './links/inspect';
import { getModel } from './model';
import type * as Pipeline from './pipeline/analyze';
import { getJson } from './net';
import { netSchemas } from './schemas-lazy';
import { ensureLexicons, precompileLexicons, SCRIPTS_BY_LANG } from './rules/engine';
import { ensureStrings, loadAllStrings } from './i18n';

export { ENGINE_VERSION } from './version';
export { setApiBase } from './net';
export { scoreLive } from './pipeline/live';
export { detectInputKind } from './detect/kind';
export { parseUpiUri } from './upi/uri';
export { maskPII } from './mask';
export { lookupIndicator } from './indicators';
export { askAssistant, searchFaq } from './assistant';
export { communityReports, reportToCommunity } from './community';
export {
  createLiveListener,
  CALL_ALERT_SIGNALS,
  type LiveListener,
  type ListenUpdate,
  type ListenAlert,
} from './listen';
export { isWeakOcr, WEAK_OCR_CONFIDENCE, WEAK_OCR_MIN_CHARS } from './ocr/quality';
export { signalText, categoryText, actionText, stageText } from './i18n';

/**
 * The full pipeline is its own chunk (SPEC_A_ENGINE.md §14): the core holds scoreLive and what it
 * needs; warmup() preloads the pipeline so the first scan does not wait for it.
 */
let pipeline: Promise<typeof Pipeline> | null = null;
const loadPipeline = () => (pipeline ??= import('./pipeline/analyze'));

export async function analyze(
  req: AnalyzeRequest,
  onStage?: (s: StageTiming) => void,
): Promise<AnalysisResult> {
  return (await loadPipeline()).analyzeRequest(req, onStage);
}

/**
 * URL inspector (§6.2): local checks always; redirect expansion and domain age when allowed and
 * online, within a 3-second budget. Offline or on any network error the local finding is returned.
 */
export async function inspectUrl(
  url: string,
  opts?: { expand?: boolean; domainAge?: boolean; signal?: AbortSignal },
): Promise<UrlFinding> {
  const local = inspectUrlLocal(normalizeText(url));
  if (opts?.expand === false && opts.domainAge === false) return local;
  return (await inspectUrlNetwork(local, opts ?? {})).finding;
}

/**
 * Loads the model, the lexicons and the strings, and compiles the lexicons. With a language,
 * only that language's lexicon packs and strings are loaded (other scripts load when first seen);
 * without one, everything is.
 */
export async function warmup(lang?: Lang): Promise<void> {
  await Promise.all([
    ensureLexicons(lang ? SCRIPTS_BY_LANG[lang] : undefined),
    lang ? ensureStrings(lang) : loadAllStrings(),
    getModel(),
    loadPipeline(),
  ]);
  precompileLexicons();
}

export async function apiHealth(): Promise<{ online: boolean; ai: boolean }> {
  const raw = await getJson('/api/health', { timeoutMs: 2000 });
  if (raw === null) return { online: false, ai: false };
  const res = (await netSchemas()).HealthResponseSchema.safeParse(raw);
  if (!res.success) return { online: false, ai: false };
  return { online: true, ai: res.data.ai.groq || res.data.ai.gemini };
}
