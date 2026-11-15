/**
 * The only module in apps/web that imports @akshi/* packages (SPEC_B_WEB.md §2.2).
 * Components import from '@/lib/engine'. Before Merge 1 these packages are stubs
 * that return fixture-shaped data; after it the same names return real results.
 */
import type { Lang, OcrResult, StageTiming } from '@akshi/contracts';
import * as engineNs from '@akshi/engine';
import i18n from './i18n';

// ── Types (SPEC.md §6) ────────────────────────────────────────────────────────
export type {
  ActionId,
  AmountFinding,
  AnalysisResult,
  AnalyzeRequest,
  Anomaly,
  AssistantAnswer,
  BrandClaim,
  Channel,
  ChatTurnRisk,
  ClaimCheck,
  CollectRequestInput,
  Drill,
  DrillChoice,
  DrillNode,
  EmergencyContent,
  EmergencyQuestion,
  EmergencyStep,
  Entities,
  EntityGraph,
  EvalReport,
  FaqItem,
  GraphEdge,
  GraphNode,
  IndicatorMatch,
  InputKind,
  L10n,
  Lang,
  Landscape,
  LayerContribution,
  LiveScore,
  Metrics,
  OcrBox,
  OcrResult,
  ParsedStatement,
  PatternCard,
  PhoneFinding,
  SampleMessage,
  ScamCategory,
  Severity,
  Signal,
  SignalId,
  Span,
  SpendCategory,
  StageTiming,
  StatementAnalysis,
  Txn,
  UpiIdFinding,
  UpiPayload,
  UrlFinding,
  Verdict,
} from '@akshi/contracts';

// ── Values from contracts ─────────────────────────────────────────────────────
export {
  AnalysisResultSchema,
  LangSchema,
  LANGS,
  SCAM_CATEGORIES,
  SIGNAL_IDS,
  VERDICTS,
  normalizeText,
} from '@akshi/contracts';

// ── Engine (isomorphic core) ──────────────────────────────────────────────────
export {
  ENGINE_VERSION,
  actionText,
  analyze,
  apiHealth,
  askAssistant,
  categoryText,
  detectInputKind,
  inspectUrl,
  lookupIndicator,
  maskPII,
  parseUpiUri,
  scoreLive,
  signalText,
} from '@akshi/engine';

// ── Stage names for the StageTicker. `stageText` is new on feat/engine (Phase 1)
//    and reaches main at Merge 1. Until then we fall back to our own locale strings;
//    after the merge the engine's version is used with no change here.
//    TODO(M1): replace with a plain re-export once main has it.
type StageName = StageTiming['stage'];
type StageTextFn = (stage: StageName, lang: Lang) => string;
const engineStageText = (engineNs as unknown as { stageText?: StageTextFn }).stageText;
const stageFallback: StageTextFn = (stage, lang) =>
  i18n.isInitialized ? i18n.t(`stage.${stage}`, { lng: lang }) : stage;

export function stageText(stage: StageName, lang: Lang): string {
  return engineStageText ? engineStageText(stage, lang) : stageFallback(stage, lang);
}

// ── warmup(lang): the real engine (feat/engine Phase 5) loads the lexicon and
//    string packs for a language; the Phase 0 stub takes no argument. Works with both.
type WarmupFn = (lang?: Lang) => Promise<void>;
export function warmup(lang?: Lang): Promise<void> {
  return (engineNs.warmup as WarmupFn)(lang);
}

// ── Engine browser entry (OCR) — loaded lazily so tesseract stays out of the
//    initial bundle (SPEC_B_WEB.md §7).
export async function ocrImage(
  image: Blob,
  langs: Lang[],
  onProgress?: (p: number) => void,
): Promise<OcrResult> {
  const browser = await import('@akshi/engine/browser');
  return browser.ocrImage(image, langs, onProgress);
}

// ── Insights (statements, graph) ──────────────────────────────────────────────
export {
  SAMPLE_STATEMENTS,
  analyzeStatement,
  buildEntityGraph,
  parseStatementCsv,
} from '@akshi/insights';

// ── Content (drills, FAQ, emergency, samples, indicators, eval report) ───────
export {
  DRILLS,
  EMERGENCY,
  EVAL_REPORT,
  FAQ,
  INDICATORS,
  LANDSCAPE,
  PATTERN_CARDS,
  SAMPLE_MESSAGES,
} from '@akshi/content';
