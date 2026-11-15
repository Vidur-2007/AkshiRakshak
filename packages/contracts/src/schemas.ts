/**
 * Shared contracts (SPEC.md §6). Frozen after Phase 0 — changes follow SPEC.md §9.4.
 * Every type is a zod schema (`<Type>Schema`) plus its inferred TypeScript type.
 * Spans are UTF-16 code-unit offsets into `AnalysisResult.text`.
 */
import { z } from 'zod';
import {
  LANGS,
  VERDICTS,
  SEVERITIES,
  INPUT_KINDS,
  CHANNELS,
  SCAM_CATEGORIES,
  SIGNAL_IDS,
  ACTION_IDS,
  SIGNAL_SOURCES,
  BRAND_KINDS,
  LAYERS,
  STAGES,
  SPEND_CATEGORIES,
  TXN_CHANNELS,
  ANOMALY_TYPES,
  EMERGENCY_QUESTION_IDS,
  EVAL_CONFIGS,
  API_ERROR_CODES,
} from './enums';

// ───────────────────────────── 6.1 Core enums ─────────────────────────────

export const LangSchema = z.enum(LANGS);
export type Lang = z.infer<typeof LangSchema>;

/** Localised string: English required, others optional (fallback to en). */
export const L10nSchema = z.object({
  en: z.string(),
  hi: z.string().optional(),
  te: z.string().optional(),
  bn: z.string().optional(),
});
export type L10n = z.infer<typeof L10nSchema>;

export const VerdictSchema = z.enum(VERDICTS);
export type Verdict = z.infer<typeof VerdictSchema>;

export const SeveritySchema = z.enum(SEVERITIES);
export type Severity = z.infer<typeof SeveritySchema>;

export const InputKindSchema = z.enum(INPUT_KINDS);
export type InputKind = z.infer<typeof InputKindSchema>;

export const ChannelSchema = z.enum(CHANNELS);
export type Channel = z.infer<typeof ChannelSchema>;

export const ScamCategorySchema = z.enum(SCAM_CATEGORIES);
export type ScamCategory = z.infer<typeof ScamCategorySchema>;

export const SignalIdSchema = z.enum(SIGNAL_IDS);
export type SignalId = z.infer<typeof SignalIdSchema>;

export const ActionIdSchema = z.enum(ACTION_IDS);
export type ActionId = z.infer<typeof ActionIdSchema>;

// ───────────────────────────── helpers ─────────────────────────────

const int0 = z.number().int().nonnegative();
const score100 = z.number().min(0).max(100);
const prob = z.number().min(0).max(1);

// ───────────────────────────── 6.2 Analysis types ─────────────────────────────

export const SpanSchema = z
  .object({ start: int0, end: int0, text: z.string() })
  .refine((s) => s.end >= s.start, { message: 'span end must be >= start' });
export type Span = z.infer<typeof SpanSchema>;

export const SignalSchema = z.object({
  id: SignalIdSchema,
  /** contribution, -1..1 (negative reduces risk) */
  weight: z.number().min(-1).max(1),
  /** localised short label */
  label: z.string(),
  /** localised one-line reason */
  detail: z.string(),
  /** may be empty */
  spans: z.array(SpanSchema),
  source: z.enum(SIGNAL_SOURCES),
});
export type Signal = z.infer<typeof SignalSchema>;

export const IndicatorMatchSchema = z.object({
  value: z.string(),
  type: z.enum(['upi', 'phone', 'domain']),
  reports: int0,
  category: ScamCategorySchema.optional(),
  campaign: z.string().optional(),
  source: z.enum(['bundled', 'community', 'blocklist']),
  sampleData: z.boolean(),
});
export type IndicatorMatch = z.infer<typeof IndicatorMatchSchema>;

export const RedirectChainSchema = z.object({
  hops: z.array(z.object({ url: z.string(), status: z.number().int() })),
  finalUrl: z.string(),
  truncated: z.boolean(),
  error: z.string().optional(),
});
export type RedirectChain = z.infer<typeof RedirectChainSchema>;

export const DomainAgeSchema = z.object({
  domain: z.string(),
  registered: z.string().optional(),
  ageDays: z.number().int().optional(),
  registrar: z.string().optional(),
  error: z.string().optional(),
});
export type DomainAge = z.infer<typeof DomainAgeSchema>;

export const UrlFindingSchema = z.object({
  raw: z.string(),
  span: SpanSchema.optional(),
  normalized: z.string(),
  host: z.string(),
  registrableDomain: z.string(),
  tld: z.string(),
  /** 0-100 */
  risk: score100,
  flags: z.array(SignalIdSchema),
  /** e.g. 'sbi.co.in' */
  lookalikeOf: z.string().optional(),
  lookalikeDiff: z
    .array(z.object({ index: int0, expected: z.string(), actual: z.string() }))
    .optional(),
  isOfficial: z.boolean(),
  isShortener: z.boolean(),
  isApk: z.boolean(),
  expanded: RedirectChainSchema.optional(),
  domainAge: DomainAgeSchema.optional(),
});
export type UrlFinding = z.infer<typeof UrlFindingSchema>;

export const UpiIdFindingSchema = z.object({
  raw: z.string(),
  span: SpanSchema.optional(),
  /** PSP handle, the part after '@' (e.g. 'ybl') */
  handle: z.string(),
  /** app or bank the handle belongs to (e.g. 'PhonePe'), or 'unknown' */
  psp: z.string(),
  pspKnown: z.boolean(),
  looksPersonal: z.boolean(),
  risk: score100,
  flags: z.array(SignalIdSchema),
  indicator: IndicatorMatchSchema.optional(),
});
export type UpiIdFinding = z.infer<typeof UpiIdFindingSchema>;

export const PhoneFindingSchema = z.object({
  raw: z.string(),
  span: SpanSchema.optional(),
  e164: z.string().optional(),
  claimedAs: z.enum(['customer_care', 'bank', 'police', 'courier', 'unknown']).optional(),
  indicator: IndicatorMatchSchema.optional(),
});
export type PhoneFinding = z.infer<typeof PhoneFindingSchema>;

export const AmountFindingSchema = z.object({
  raw: z.string(),
  span: SpanSchema.optional(),
  value: z.number().nonnegative(),
  currency: z.literal('INR'),
});
export type AmountFinding = z.infer<typeof AmountFindingSchema>;

export const BrandClaimSchema = z.object({
  brand: z.string(),
  kind: z.enum(BRAND_KINDS),
  span: SpanSchema.optional(),
  officialDomains: z.array(z.string()),
  mismatch: z.boolean(),
  evidence: z.string().optional(),
});
export type BrandClaim = z.infer<typeof BrandClaimSchema>;

export const EntitiesSchema = z.object({
  urls: z.array(UrlFindingSchema),
  upiIds: z.array(UpiIdFindingSchema),
  phones: z.array(PhoneFindingSchema),
  amounts: z.array(AmountFindingSchema),
  emails: z.array(z.string()),
  apkMentions: z.array(SpanSchema),
  brands: z.array(BrandClaimSchema),
});
export type Entities = z.infer<typeof EntitiesSchema>;

export const UpiPayloadSchema = z.object({
  raw: z.string(),
  valid: z.boolean(),
  issues: z.array(z.string()),
  pa: z.string().optional(),
  pn: z.string().optional(),
  am: z.number().optional(),
  cu: z.string().optional(),
  tn: z.string().optional(),
  mc: z.string().optional(),
  tr: z.string().optional(),
  url: z.string().optional(),
  mode: z.string().optional(),
});
export type UpiPayload = z.infer<typeof UpiPayloadSchema>;

export const CollectRequestInputSchema = z.object({
  requesterUpi: z.string().optional(),
  requesterName: z.string().optional(),
  amount: z.number().nonnegative().optional(),
  note: z.string().optional(),
  /** "they said I will receive money" */
  toldYouWillReceive: z.boolean(),
  contactedFirst: z.enum(['them', 'me', 'unknown']),
  underPressure: z.boolean(),
  knowRequester: z.enum(['yes', 'no', 'unsure']),
});
export type CollectRequestInput = z.infer<typeof CollectRequestInputSchema>;

export const OcrBoxSchema = z.object({
  text: z.string(),
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
  start: int0,
  end: int0,
});
export type OcrBox = z.infer<typeof OcrBoxSchema>;

export const OcrResultSchema = z.object({
  text: z.string(),
  boxes: z.array(OcrBoxSchema),
  width: z.number(),
  height: z.number(),
  /** tesseract mean confidence, 0-100 (weak OCR is < 55, SPEC_A §10) */
  confidence: score100,
  langs: z.array(LangSchema),
});
export type OcrResult = z.infer<typeof OcrResultSchema>;

export const ClaimCheckSchema = z.object({
  claim: z.string(),
  reality: z.string(),
  mismatch: z.boolean(),
  signal: SignalIdSchema.optional(),
});
export type ClaimCheck = z.infer<typeof ClaimCheckSchema>;

export const LayerContributionSchema = z.object({
  layer: z.enum(LAYERS),
  /** 0-100, this layer alone */
  score: score100,
  /** 0-1, share of the final score */
  share: prob,
  available: z.boolean(),
});
export type LayerContribution = z.infer<typeof LayerContributionSchema>;

export const StageTimingSchema = z.object({
  stage: z.enum(STAGES),
  ms: z.number().nonnegative(),
  status: z.enum(['running', 'done', 'skipped', 'failed']),
});
export type StageTiming = z.infer<typeof StageTimingSchema>;

export const ChatTurnRiskSchema = z.object({
  index: int0,
  sender: z.enum(['them', 'me', 'unknown']),
  text: z.string(),
  risk: score100,
  start: int0,
  end: int0,
});
export type ChatTurnRisk = z.infer<typeof ChatTurnRiskSchema>;

const AbortSignalSchema = z.custom<AbortSignal>(
  (v) => typeof AbortSignal !== 'undefined' && v instanceof AbortSignal,
  { message: 'expected an AbortSignal' },
);

export const AnalyzeRequestSchema = z.object({
  kind: InputKindSchema,
  /** message, chat, email, OCR text, note */
  text: z.string().optional(),
  url: z.string().optional(),
  upiId: z.string().optional(),
  phone: z.string().optional(),
  /** raw decoded QR string */
  qrPayload: z.string().optional(),
  collect: CollectRequestInputSchema.optional(),
  /** for kind 'image' (call ocrImage first) */
  ocr: OcrResultSchema.optional(),
  channel: ChannelSchema.optional(),
  /** language for labels and explanation */
  lang: LangSchema,
  options: z
    .object({
      /** default false */
      cloudAI: z.boolean().optional(),
      /** default true when online */
      expandLinks: z.boolean().optional(),
      /** default true when online */
      domainAge: z.boolean().optional(),
      /** eval toggles */
      layers: z
        .partialRecord(z.enum(['model', 'links', 'indicators', 'ai']), z.boolean())
        .optional(),
      /** values the user blocked (from web storage) */
      blocklist: z.array(z.string()).optional(),
      signal: AbortSignalSchema.optional(),
    })
    .optional(),
});
export type AnalyzeRequest = z.infer<typeof AnalyzeRequestSchema>;

export const AnalysisResultSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  kind: InputKindSchema,
  lang: LangSchema,
  detectedLang: z.union([LangSchema, z.literal('mixed'), z.literal('other')]),
  /** normalised text; all spans index into this */
  text: z.string(),
  verdict: VerdictSchema,
  riskScore: z.number().int().min(0).max(100),
  severity: SeveritySchema,
  /** 0-1 */
  confidence: prob,
  category: ScamCategorySchema.nullable(),
  categoryConfidence: prob,
  /** sorted by weight, descending */
  signals: z.array(SignalSchema),
  claimVsReality: z.array(ClaimCheckSchema),
  entities: EntitiesSchema,
  qr: UpiPayloadSchema.optional(),
  layers: z.array(LayerContributionSchema),
  /** 1-2 sentences, localised */
  explanation: z.string(),
  /** ordered by importance */
  actions: z.array(ActionIdSchema),
  stages: z.array(StageTimingSchema),
  chat: z.array(ChatTurnRiskSchema).optional(),
  image: z
    .object({
      width: z.number(),
      height: z.number(),
      boxes: z.array(OcrBoxSchema.extend({ signalIds: z.array(SignalIdSchema) })),
    })
    .optional(),
  aiUsed: z.boolean(),
  aiProvider: z.enum(['groq', 'gemini']).optional(),
  offline: z.boolean(),
  latencyMs: z.number().nonnegative(),
  engineVersion: z.string(),
  modelVersion: z.string().optional(),
});
export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;

export const LiveScoreSchema = z.object({
  riskScore: z.number().int().min(0).max(100),
  verdict: VerdictSchema,
  topSignals: z.array(SignalIdSchema),
});
export type LiveScore = z.infer<typeof LiveScoreSchema>;

export const AssistantAnswerSchema = z.object({
  answer: z.string(),
  sources: z.array(z.string()),
  mode: z.enum(['offline', 'online']),
  provider: z.enum(['groq', 'gemini']).optional(),
});
export type AssistantAnswer = z.infer<typeof AssistantAnswerSchema>;

// ───────────────────────────── 6.3 Model types ─────────────────────────────

export const ContributionSchema = z.object({
  feature: z.string(),
  value: z.number(),
  spans: z.array(SpanSchema),
});
export type Contribution = z.infer<typeof ContributionSchema>;

export const ModelPredictionSchema = z.object({
  /** 0-1 */
  pScam: prob,
  category: ScamCategorySchema.nullable(),
  categoryProbs: z.partialRecord(ScamCategorySchema, prob),
  /** top 25 positive, value desc */
  contributions: z.array(ContributionSchema),
});
export type ModelPrediction = z.infer<typeof ModelPredictionSchema>;

export const TextModelSchema = z.object({
  version: z.string(),
  predict: z.custom<(normalizedText: string) => ModelPrediction>((v) => typeof v === 'function', {
    message: 'expected a predict function',
  }),
});
export type TextModel = z.infer<typeof TextModelSchema>;

export const CalibrationSchema = z.object({
  version: z.string(),
  /** defaults 70 / 40 */
  thresholds: z.object({ scam: score100, suspicious: score100 }),
  /** defaults 0.45 / 0.35 / 0.20 */
  fusion: z.object({ rules: prob, model: prob, links: prob }),
  /** default 0.2 */
  aiBlend: prob,
});
export type Calibration = z.infer<typeof CalibrationSchema>;

// ───────────────────────────── 6.4 Statement, graph and content types ─────────────────────────────

export const SpendCategorySchema = z.enum(SPEND_CATEGORIES);
export type SpendCategory = z.infer<typeof SpendCategorySchema>;

export const TxnSchema = z.object({
  id: z.string(),
  /** ISO datetime; time 00:00 if unknown */
  date: z.string(),
  hasTime: z.boolean(),
  description: z.string(),
  amount: z.number().nonnegative(),
  direction: z.enum(['debit', 'credit']),
  balance: z.number().optional(),
  channel: z.enum(TXN_CHANNELS),
  counterparty: z.string().optional(),
  upiId: z.string().optional(),
  category: SpendCategorySchema,
});
export type Txn = z.infer<typeof TxnSchema>;

export const ParsedStatementSchema = z.object({
  txns: z.array(TxnSchema),
  errors: z.array(z.string()),
  format: z.enum(['canonical', 'bank_a', 'bank_b', 'unknown']),
});
export type ParsedStatement = z.infer<typeof ParsedStatementSchema>;

export const AnomalySchema = z.object({
  id: z.string(),
  txnIds: z.array(z.string()),
  type: z.enum(ANOMALY_TYPES),
  severity: z.enum(['high', 'medium', 'low']),
  /** 0-1 */
  score: prob,
  /** localised */
  title: z.string(),
  /** localised */
  explanation: z.string(),
  features: z.array(z.object({ name: z.string(), value: z.string(), baseline: z.string() })),
});
export type Anomaly = z.infer<typeof AnomalySchema>;

export const StatementAnalysisSchema = z.object({
  txns: z.array(TxnSchema),
  anomalies: z.array(AnomalySchema),
  baseline: z.object({
    medianDebit: z.number(),
    p90Debit: z.number(),
    usualHours: z.tuple([z.number(), z.number()]).nullable(),
    frequentPayees: z.array(z.string()),
  }),
  summary: z.object({
    totalIn: z.number(),
    totalOut: z.number(),
    byCategory: z.array(z.object({ category: SpendCategorySchema, amount: z.number() })),
    byMonth: z.array(z.object({ month: z.string(), in: z.number(), out: z.number() })),
  }),
  riskScore: score100,
  narrative: z.string(),
});
export type StatementAnalysis = z.infer<typeof StatementAnalysisSchema>;

export const GraphNodeSchema = z.object({
  id: z.string(),
  type: z.enum(['phone', 'upi', 'domain', 'campaign']),
  label: z.string(),
  risk: score100,
  mine: z.boolean(),
  reports: int0,
  sampleData: z.boolean(),
});
export type GraphNode = z.infer<typeof GraphNodeSchema>;

export const GraphEdgeSchema = z.object({
  source: z.string(),
  target: z.string(),
  kind: z.enum(['appears_with', 'part_of']),
});
export type GraphEdge = z.infer<typeof GraphEdgeSchema>;

export const EntityGraphSchema = z.object({
  nodes: z.array(GraphNodeSchema),
  edges: z.array(GraphEdgeSchema),
  stats: z.object({ clusters: int0, largestCluster: int0 }),
});
export type EntityGraph = z.infer<typeof EntityGraphSchema>;

export const DrillChoiceSchema = z.object({
  id: z.string(),
  text: L10nSchema,
  next: z.string(),
  points: z.number(),
  feedback: L10nSchema,
  redFlag: SignalIdSchema.optional(),
});
export type DrillChoice = z.infer<typeof DrillChoiceSchema>;

export const DrillNodeSchema = z.object({
  id: z.string(),
  from: z.enum(['them', 'system']),
  text: L10nSchema,
  choices: z.array(DrillChoiceSchema).optional(),
  end: z.enum(['safe', 'scammed']).optional(),
});
export type DrillNode = z.infer<typeof DrillNodeSchema>;

export const DrillSchema = z.object({
  id: z.string(),
  title: L10nSchema,
  category: ScamCategorySchema,
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  channel: z.enum(['whatsapp', 'sms', 'call']),
  persona: z.object({
    name: z.string(),
    avatar: z.enum(['bank', 'police', 'courier', 'recruiter', 'buyer', 'support', 'unknown']),
  }),
  langs: z.array(LangSchema),
  start: z.string(),
  nodes: z.record(z.string(), DrillNodeSchema),
});
export type Drill = z.infer<typeof DrillSchema>;

export const FaqItemSchema = z.object({
  id: z.string(),
  q: L10nSchema,
  a: L10nSchema,
  tags: z.array(z.string()),
});
export type FaqItem = z.infer<typeof FaqItemSchema>;

export const EmergencyQuestionSchema = z.object({
  id: z.enum(EMERGENCY_QUESTION_IDS),
  text: L10nSchema,
});
export type EmergencyQuestion = z.infer<typeof EmergencyQuestionSchema>;

export const EmergencyStepSchema = z.object({
  id: z.string(),
  when: z.union([
    z.array(z.enum(EMERGENCY_QUESTION_IDS)),
    z.literal('always'),
    z.literal('no_loss'),
  ]),
  priority: z.number(),
  title: L10nSchema,
  body: L10nSchema,
  action: z
    .object({
      kind: z.enum(['tel', 'url', 'internal']),
      value: z.string(),
      label: L10nSchema,
    })
    .optional(),
});
export type EmergencyStep = z.infer<typeof EmergencyStepSchema>;

export const EmergencyContentSchema = z.object({
  questions: z.array(EmergencyQuestionSchema),
  steps: z.array(EmergencyStepSchema),
  evidenceChecklist: z.array(L10nSchema),
});
export type EmergencyContent = z.infer<typeof EmergencyContentSchema>;

export const IndicatorSchema = z.object({
  value: z.string(),
  type: z.enum(['upi', 'phone', 'domain']),
  category: ScamCategorySchema,
  reports: int0,
  campaign: z.string().optional(),
  sampleData: z.literal(true),
});
export type Indicator = z.infer<typeof IndicatorSchema>;

export const SampleMessageSchema = z.object({
  id: z.string(),
  label: L10nSchema,
  kind: InputKindSchema,
  lang: LangSchema,
  text: z.string(),
  expected: VerdictSchema,
  genuine: z.boolean(),
});
export type SampleMessage = z.infer<typeof SampleMessageSchema>;

export const PatternCardSchema = z.object({
  id: z.string(),
  category: ScamCategorySchema,
  title: L10nSchema,
  body: L10nSchema,
  sourceUrl: z.string().optional(),
});
export type PatternCard = z.infer<typeof PatternCardSchema>;

export const LandscapeSchema = z.object({
  byCategory: z.array(z.object({ category: ScamCategorySchema, count: int0 })),
  byLang: z.array(z.object({ lang: LangSchema, count: int0 })),
  byChannel: z.array(z.object({ channel: ChannelSchema, count: int0 })),
  sampleData: z.literal(true),
});
export type Landscape = z.infer<typeof LandscapeSchema>;

export const MetricsSchema = z.object({
  precision: prob,
  recall: prob,
  f1: prob,
  accuracy: prob,
  fpr: prob,
  support: int0,
});
export type Metrics = z.infer<typeof MetricsSchema>;

export const EvalReportSchema = z.object({
  generatedAt: z.string(),
  engineVersion: z.string(),
  modelVersion: z.string(),
  datasets: z.array(z.object({ name: z.string(), size: int0, description: z.string() })),
  /** full system without AI on the synthetic test split */
  overall: MetricsSchema,
  /** team-written test set */
  handwritten: MetricsSchema.nullable(),
  configs: z.array(z.object({ name: z.enum(EVAL_CONFIGS), metrics: MetricsSchema, n: int0 })),
  perCategory: z.array(z.object({ category: ScamCategorySchema, recall: prob, support: int0 })),
  perLang: z.array(
    z.object({ lang: LangSchema, precision: prob, recall: prob, f1: prob, support: int0 }),
  ),
  /** false alarms on genuine bank/OTP SMS */
  fprGenuineBank: prob,
  confusion: z.object({ labels: z.array(z.string()), matrix: z.array(z.array(z.number())) }),
  latency: z.object({ p50Ms: z.number().nonnegative(), p95Ms: z.number().nonnegative() }),
  statements: z
    .object({ injected: int0, caught: int0, falseFlagsPer100: z.number().nonnegative() })
    .nullable(),
  notes: z.array(z.string()),
});
export type EvalReport = z.infer<typeof EvalReportSchema>;

// ───────────────────────────── 6.6 HTTP API ─────────────────────────────

export const ApiErrorCodeSchema = z.enum(API_ERROR_CODES);
export type ApiErrorCode = z.infer<typeof ApiErrorCodeSchema>;

export const ApiErrorSchema = z.object({
  error: z.object({ code: ApiErrorCodeSchema, message: z.string() }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

export const AiAnalyzeRequestSchema = z.object({
  /** ≤ 4,000 chars, already masked by maskPII */
  maskedText: z.string().max(4000),
  kind: InputKindSchema,
  lang: LangSchema,
  ruleSignals: z.array(SignalIdSchema),
  localCategory: ScamCategorySchema.nullable(),
  localScore: score100,
});
export type AiAnalyzeRequest = z.infer<typeof AiAnalyzeRequestSchema>;

export const AiAnalyzeResponseSchema = z.object({
  provider: z.enum(['groq', 'gemini']),
  model: z.string(),
  category: ScamCategorySchema.nullable(),
  /** 0-100 */
  likelihood: score100,
  /** ≤ 60 words, in lang */
  explanation: z.string(),
  /** ≤ 5; quote is an exact substring of maskedText */
  redFlags: z.array(z.object({ quote: z.string(), reason: z.string() })).max(5),
  advice: z.string(),
});
export type AiAnalyzeResponse = z.infer<typeof AiAnalyzeResponseSchema>;

/** POST /api/ai/vision (P2). imageBase64 ≤ 1.5 MB. */
export const AiVisionRequestSchema = z.object({
  imageBase64: z.string().max(1_500_000 * 1.37),
  lang: LangSchema,
});
export type AiVisionRequest = z.infer<typeof AiVisionRequestSchema>;

export const AiVisionResponseSchema = z.object({ text: z.string() });
export type AiVisionResponse = z.infer<typeof AiVisionResponseSchema>;

/** POST /api/ask */
export const AskRequestSchema = z.object({
  question: z.string(),
  lang: LangSchema,
  faqIds: z.array(z.string()),
});
export type AskRequest = z.infer<typeof AskRequestSchema>;

/** GET /api/health */
export const HealthResponseSchema = z.object({
  ok: z.literal(true),
  version: z.string(),
  ai: z.object({ groq: z.boolean(), gemini: z.boolean() }),
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export const ReportTypeSchema = z.enum(['upi', 'phone', 'domain']);
export type ReportType = z.infer<typeof ReportTypeSchema>;

/** GET /api/reports?type=&value= (P2) */
export const ReportsQuerySchema = z.object({ type: ReportTypeSchema, value: z.string() });
export type ReportsQuery = z.infer<typeof ReportsQuerySchema>;

export const ReportsGetResponseSchema = z.object({
  reports: int0,
  category: ScamCategorySchema.optional(),
});
export type ReportsGetResponse = z.infer<typeof ReportsGetResponseSchema>;

/** POST /api/reports (P2) */
export const ReportsPostRequestSchema = z.object({
  type: ReportTypeSchema,
  value: z.string(),
  category: ScamCategorySchema,
});
export type ReportsPostRequest = z.infer<typeof ReportsPostRequestSchema>;

export const ReportsPostResponseSchema = z.object({ ok: z.literal(true), reports: int0 });
export type ReportsPostResponse = z.infer<typeof ReportsPostResponseSchema>;
