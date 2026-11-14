/**
 * The only module in apps/web that imports @akshi/* packages (SPEC_B_WEB.md §2.2).
 * Components import from '@/lib/engine'. Before Merge 1 these packages are stubs
 * that return fixture-shaped data; after it the same names return real results.
 */
import type { Lang, OcrResult } from '@akshi/contracts';

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
  warmup,
} from '@akshi/engine';

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
