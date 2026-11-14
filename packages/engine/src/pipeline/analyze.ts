/**
 * analyze() orchestration (SPEC.md §7.2): read → ocr → links → patterns → model → ai → fusion.
 * Every stage reports `running` then `done`/`skipped`/`failed` through onStage with real timings.
 *
 * P1 status: read and patterns are complete; links does local structural checks plus indicator
 * and blocklist lookup; model is stub-safe; ai is skipped (P3); claims-vs-reality and brand
 * claims arrive in P2.
 */
import {
  normalizeText,
  type AnalysisResult,
  type AnalyzeRequest,
  type Entities,
  type IndicatorMatch,
  type Lang,
  type ModelPrediction,
  type Signal,
  type SignalId,
  type Span,
  type StageTiming,
} from '@akshi/contracts';
import { loadCalibration, MODEL_VERSION } from '@akshi/model';
import { claimsVsReality, detectBrands } from '../claims/brands';
import { chatTurns } from '../context/chat';
import { countScripts, detectLang, scriptsPresent } from '../detect/lang';
import { dedupeSpans, extractEntities } from '../extract/entities';
import { signalText } from '../i18n';
import { blocklistMatch, lookupIndicator } from '../indicators';
import { getModel, modelSignal } from '../model';
import { CATALOG } from '../rules/catalog';
import { matchRules, toSignals } from '../rules/engine';
import { collectToText } from '../upi/collect';
import { parseUpiUri } from '../upi/uri';
import { ENGINE_VERSION } from '../version';
import { chooseActions } from './actions';
import { explain } from './explain';
import { chooseCategory, confidenceOf, fuse, severityOf, verdictOf } from './fusion';
import { scoreLive } from './live';

const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const round2 = (n: number): number => Math.round(n * 100) / 100;

function newId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  return c?.randomUUID
    ? c.randomUUID()
    : `scan-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** The raw text analysed for each input kind (before normalisation). */
export function rawInputText(req: AnalyzeRequest): string {
  switch (req.kind) {
    case 'url':
      return req.url ?? req.text ?? '';
    case 'upi_id':
      return req.upiId ?? req.text ?? '';
    case 'phone':
      return req.phone ?? req.text ?? '';
    case 'qr':
      // decoded so that pn / tn read naturally in highlights; result.qr keeps the raw payload
      return safeDecode(req.qrPayload ?? req.text ?? '');
    case 'image':
      return req.ocr?.text ?? req.text ?? '';
    case 'collect_request':
      return req.collect
        ? [collectToText(req.collect), req.text ?? ''].filter(Boolean).join(' ')
        : (req.text ?? '');
    default:
      return req.text ?? '';
  }
}

/** Signals from local URL flags, with the spans of the URLs that carry each flag. */
function urlSignals(entities: Entities, lang: Lang): Signal[] {
  const byFlag = new Map<SignalId, Span[]>();
  for (const u of entities.urls) {
    for (const f of u.flags) {
      const list = byFlag.get(f) ?? [];
      if (u.span) list.push(u.span);
      byFlag.set(f, list);
    }
  }
  return [...byFlag].map(([id, spans]) => ({
    id,
    weight: weightOf(id),
    source: 'url' as const,
    ...signalText(id, lang),
    spans,
  }));
}

const weightOf = (id: SignalId) => CATALOG[id].weight;

interface IndicatorPass {
  signals: Signal[];
  score: number | null;
  maxReports: number;
}

function indicatorPass(
  entities: Entities,
  blocklist: readonly string[] | undefined,
  lang: Lang,
  useIndicators: boolean,
): IndicatorPass {
  const known: Span[] = [];
  const blocked: Span[] = [];
  let maxReports = 0;
  let anyBlocked = false;
  let anyKnown = false;
  const check = (value: string, span: Span | undefined, attach?: (m: IndicatorMatch) => void) => {
    const b = blocklistMatch(value, blocklist);
    if (b) {
      anyBlocked = true;
      if (span) blocked.push(span);
      attach?.(b);
      return;
    }
    if (!useIndicators) return;
    const k = lookupIndicator(value);
    if (k) {
      anyKnown = true;
      maxReports = Math.max(maxReports, k.reports);
      if (span) known.push(span);
      attach?.(k);
    }
  };
  for (const u of entities.upiIds) check(u.raw, u.span, (m) => (u.indicator = m));
  for (const p of entities.phones) check(p.e164 ?? p.raw, p.span, (m) => (p.indicator = m));
  for (const u of entities.urls) check(u.registrableDomain, u.span);

  const signals: Signal[] = [];
  if (anyBlocked)
    signals.push({
      id: 'BLOCKLISTED',
      weight: weightOf('BLOCKLISTED'),
      source: 'indicator',
      ...signalText('BLOCKLISTED', lang),
      spans: dedupeSpans(blocked),
    });
  if (anyKnown)
    signals.push({
      id: 'KNOWN_INDICATOR',
      weight: weightOf('KNOWN_INDICATOR'),
      source: 'indicator',
      ...signalText('KNOWN_INDICATOR', lang),
      spans: dedupeSpans(known),
    });
  const score = anyBlocked || maxReports >= 3 ? 95 : anyKnown ? 60 : null;
  return { signals, score, maxReports };
}

/** Merge signals with the same id (e.g. APK_LINK from a URL and from wording). */
function mergeSignals(signals: Signal[]): Signal[] {
  const byId = new Map<SignalId, Signal>();
  for (const s of signals) {
    const prev = byId.get(s.id);
    if (!prev) byId.set(s.id, { ...s, spans: [...s.spans] });
    else prev.spans = dedupeSpans([...prev.spans, ...s.spans]);
  }
  return [...byId.values()].sort((a, b) => b.weight - a.weight);
}

export async function analyzeRequest(
  req: AnalyzeRequest,
  onStage?: (s: StageTiming) => void,
): Promise<AnalysisResult> {
  const t0 = now();
  const opts = req.options ?? {};
  const signal = opts.signal;
  signal?.throwIfAborted();
  const layerOn = (l: 'model' | 'links' | 'indicators' | 'ai') => opts.layers?.[l] !== false;
  const stages: StageTiming[] = [];
  const emit = (s: StageTiming) => {
    stages.push(s);
    onStage?.(s);
  };
  const skip = (stage: StageTiming['stage']) => emit({ stage, ms: 0, status: 'skipped' });
  async function run<T>(stage: StageTiming['stage'], fn: () => T | Promise<T>): Promise<T> {
    onStage?.({ stage, ms: 0, status: 'running' });
    const s0 = now();
    try {
      const out = await fn();
      emit({ stage, ms: round2(now() - s0), status: 'done' });
      return out;
    } catch (err) {
      emit({ stage, ms: round2(now() - s0), status: 'failed' });
      throw err;
    }
  }

  // read
  const raw = rawInputText(req);
  const read = await run('read', () => {
    const text = normalizeText(raw);
    const counts = countScripts(text);
    return { text, detectedLang: detectLang(text, counts), scripts: scriptsPresent(counts) };
  });
  const { text } = read;

  // ocr happens before analyze() via ocrImage(); the result is passed in req.ocr
  skip('ocr');

  // links: entities, local URL checks, indicators and blocklist
  const links = await run('links', () => {
    const entities = extractEntities(text);
    entities.brands = detectBrands(text);
    const ind = indicatorPass(entities, opts.blocklist, req.lang, layerOn('indicators'));
    return { entities, ind, urlSigs: layerOn('links') ? urlSignals(entities, req.lang) : [] };
  });
  const { entities } = links;
  signal?.throwIfAborted();

  // patterns: lexicons, negation and safety handling, obfuscation
  const patternSignals = await run('patterns', () => {
    let hits = matchRules(text, read.scripts);
    if (entities.phones.length === 0) hits = hits.filter((h) => h.id !== 'CUSTOMER_CARE_NUMBER');
    return toSignals(hits, req.lang);
  });
  const apk = patternSignals.find((s) => s.id === 'APK_LINK');
  if (apk) entities.apkMentions = dedupeSpans([...entities.apkMentions, ...apk.spans]);

  // model
  let prediction: ModelPrediction | null = null;
  let modelSig: Signal | null = null;
  const model = layerOn('model') ? await getModel() : null;
  if (model && text) {
    prediction = await run('model', () => model.predict(text));
    modelSig = modelSignal(text, prediction, req.lang);
  } else skip('model');

  // ai (P3)
  skip('ai');
  signal?.throwIfAborted();

  const signals = mergeSignals([
    ...patternSignals,
    ...links.urlSigs,
    ...links.ind.signals,
    ...(modelSig ? [modelSig] : []),
  ]);
  const calibration = loadCalibration();
  const modelScore = prediction ? Math.round(100 * prediction.pScam) : null;
  const fusion = fuse({
    signals,
    entities,
    calibration,
    useLinks: layerOn('links'),
    indicators: links.ind.score,
    maxReports: links.ind.maxReports,
    model: modelScore,
    ai: null,
  });
  const verdict = verdictOf(fusion.riskScore, calibration);
  const { category, confidence: categoryConfidence } = chooseCategory(
    verdict,
    signals,
    text,
    prediction,
  );

  const result: AnalysisResult = {
    id: newId(),
    createdAt: new Date().toISOString(),
    kind: req.kind,
    lang: req.lang,
    detectedLang: read.detectedLang,
    text,
    verdict,
    riskScore: fusion.riskScore,
    severity: severityOf(fusion.riskScore),
    confidence: confidenceOf(signals, fusion.rules, modelScore, verdict, text.length),
    category,
    categoryConfidence,
    signals,
    claimVsReality: claimsVsReality(entities, req.lang),
    entities,
    layers: fusion.layers,
    explanation: explain(verdict, category, signals, req.lang),
    actions: [],
    stages,
    aiUsed: false,
    offline: true,
    latencyMs: 0,
    engineVersion: ENGINE_VERSION,
    modelVersion: MODEL_VERSION,
  };
  if (req.kind === 'qr') result.qr = parseUpiUri(req.qrPayload ?? req.text ?? '');
  if (req.kind === 'chat')
    result.chat = chatTurns(raw, text, (t) => scoreLive(t, req.lang).riskScore);
  const userText =
    req.kind === 'collect_request'
      ? (req.collect?.note ?? '')
      : (result.chat ?? [])
          .filter((t) => t.sender === 'me')
          .map((t) => t.text)
          .join(' ');
  result.actions = chooseActions(verdict, category, signals, text, normalizeText(userText));
  if (req.kind === 'image' && req.ocr && normalizeText(req.ocr.text) === req.ocr.text) {
    result.image = {
      width: req.ocr.width,
      height: req.ocr.height,
      boxes: req.ocr.boxes.map((b) => ({
        ...b,
        signalIds: signals
          .filter((s) => s.spans.some((sp) => sp.start < b.end && b.start < sp.end))
          .map((s) => s.id),
      })),
    };
  }
  result.latencyMs = round2(now() - t0);
  return result;
}
