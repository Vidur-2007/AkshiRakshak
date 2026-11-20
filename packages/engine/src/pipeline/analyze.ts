/**
 * analyze() orchestration (SPEC.md §7.2): read → ocr → links → patterns → model → ai → fusion.
 * Every stage reports `running` then `done`/`skipped`/`failed` through onStage with real timings.
 *
 * Works fully offline for message, url, upi_id, phone, qr and collect_request. Network extras
 * (redirect expansion, domain age) run only when allowed and online, within a 3-second budget,
 * and never fail the scan. The model stage is stub-safe (layer unavailable when no model loads).
 * The AI stage runs only when options.cloudAI is true and the device is online; it sends masked
 * text to /api/ai/analyze and is blended per §8.2 (never more than +15 points).
 */
import {
  normalizeText,
  type ActionId,
  type AiAnalyzeResponse,
  type AnalysisResult,
  type AnalyzeRequest,
  type ClaimCheck,
  type ScamCategory,
  type Entities,
  type IndicatorMatch,
  type Lang,
  type ModelPrediction,
  type Signal,
  type SignalId,
  type Span,
  type StageTiming,
} from '@akshi/contracts';
import { MODEL_VERSION } from '@akshi/model';
import { currentCalibration } from './calibration';
import { analyzeIdentity } from '../claims/brands';
import { analyzeChat, type ChatAnalysis } from '../context/chat';
import { analyzeEmail, type EmailAnalysis } from '../context/email';
import { isWeakOcr } from '../ocr/quality';
import { detectCollectScreen, type CollectScreen } from '../upi/collectScreen';
import { countScripts, detectLang, scriptsPresent } from '../detect/lang';
import { dedupeSpans, extractEntities } from '../extract/entities';
import { categoryText, ensureStrings, signalText, template } from '../i18n';
import { blocklistMatch, lookupIndicator } from '../indicators';
import { inspectUrlsNetwork, rescoreUrl } from '../links/inspect';
import { getModel, modelSignal, safePredict } from '../model';
import { aiSignals, isOnline, requestAiOpinion } from '../ai';
import { CATALOG } from '../rules/catalog';
import { ensureLexicons, matchRules, modelText, toSignals } from '../rules/engine';
import {
  analyzeCollect,
  COLLECT_ACTIONS,
  collectToText,
  type CollectAnalysis,
} from '../upi/collect';
import { analyzeQr, type QrAnalysis } from '../upi/qr';
import { ENGINE_VERSION } from '../version';
import { chooseActions, MONEY_LOST } from './actions';
import { explain } from './explain';
import { chooseCategory, confidenceOf, fuse, severityOf, verdictOf } from './fusion';
import { scoreLive } from './live';
import { noisyOrRisk } from '../links/inspect';

const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const round2 = (n: number): number => Math.round(n * 100) / 100;
const weightOf = (id: SignalId) => CATALOG[id].weight;

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

/** Signals from URL flags, with the spans of the URLs that carry each flag. */
function urlSignals(entities: Entities, lang: Lang): Signal[] {
  const byFlag = new Map<SignalId, Span[]>();
  for (const u of entities.urls) {
    for (const f of u.flags) {
      if (f === 'OFFICIAL_DOMAIN' || f === 'BRAND_MISMATCH') continue; // message-level, from claims
      const list = byFlag.get(f) ?? [];
      if (u.span) list.push(u.span);
      byFlag.set(f, list);
    }
  }
  return [...byFlag].map(([id, spans]) => {
    const young =
      id === 'NEW_DOMAIN' && entities.urls.some((u) => (u.domainAge?.ageDays ?? 999) < 30);
    return {
      id,
      weight: young ? 0.45 : weightOf(id),
      source: 'url' as const,
      ...signalText(id, lang),
      spans,
    };
  });
}

interface IndicatorPass {
  signals: Signal[];
  score: number | null;
  maxReports: number;
  /** category of the matched indicator with the most reports */
  category?: ScamCategory;
  blocked: boolean;
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
  let topCategory: ScamCategory | undefined;
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
      if (k.reports >= maxReports && k.category) topCategory = k.category;
      maxReports = Math.max(maxReports, k.reports);
      if (span) known.push(span);
      attach?.(k);
    }
  };
  for (const u of entities.upiIds) check(u.raw, u.span, (m) => (u.indicator = m));
  for (const p of entities.phones) check(p.e164 ?? p.raw, p.span, (m) => (p.indicator = m));
  for (const u of entities.urls) check(u.registrableDomain, u.span);

  const signals: Signal[] = [];
  const sig = (id: SignalId, spans: Span[]): Signal => ({
    id,
    weight: weightOf(id),
    source: 'indicator',
    ...signalText(id, lang),
    spans: dedupeSpans(spans),
  });
  if (anyBlocked) signals.push(sig('BLOCKLISTED', blocked));
  if (anyKnown) signals.push(sig('KNOWN_INDICATOR', known));
  const score = anyBlocked || maxReports >= 3 ? 95 : anyKnown ? 60 : null;
  return {
    signals,
    score,
    maxReports,
    blocked: anyBlocked,
    ...(topCategory ? { category: topCategory } : {}),
  };
}

/** Merge signals with the same id: union of spans, highest weight. */
function mergeSignals(signals: Signal[]): Signal[] {
  const byId = new Map<SignalId, Signal>();
  for (const s of signals) {
    const prev = byId.get(s.id);
    if (!prev) byId.set(s.id, { ...s, spans: [...s.spans] });
    else {
      prev.spans = dedupeSpans([...prev.spans, ...s.spans]);
      prev.weight = Math.max(prev.weight, s.weight);
    }
  }
  return [...byId.values()].sort((a, b) => b.weight - a.weight);
}

function dedupeClaims(claims: ClaimCheck[]): ClaimCheck[] {
  const seen = new Set<string>();
  return claims.filter((c) => {
    const k = `${c.claim}|${c.reality}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
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

  // ── read ──
  const raw = rawInputText(req);
  const read = await run('read', () => {
    const text = normalizeText(raw);
    const counts = countScripts(text);
    return { text, detectedLang: detectLang(text, counts), scripts: scriptsPresent(counts) };
  });
  const { text } = read;
  // lazy packs (§14): lexicons for the scripts in the text, strings for the user's language
  await Promise.all([ensureLexicons(read.scripts), ensureStrings(req.lang)]);

  // ── ocr: happens before analyze() via ocrImage(); the result arrives in req.ocr ──
  skip('ocr');

  // ── links: entities, local URL/UPI checks, QR payload, network extras, indicators ──
  const links = await run('links', async () => {
    const entities = extractEntities(text);
    const qr: QrAnalysis | undefined =
      req.kind === 'qr' ? analyzeQr(req.qrPayload ?? req.text ?? '', text, req.lang) : undefined;
    let networkUsed = false;
    if (
      layerOn('links') &&
      entities.urls.length &&
      (opts.expandLinks !== false || opts.domainAge !== false)
    ) {
      networkUsed = await inspectUrlsNetwork(entities.urls, {
        expand: opts.expandLinks !== false,
        domainAge: opts.domainAge !== false,
        ...(signal ? { signal } : {}),
      });
    }
    return { entities, qr, networkUsed };
  });
  const { entities, qr } = links;
  signal?.throwIfAborted();

  // ── patterns: lexicons, then identity (claims vs reality) and the collect form ──
  const patterns = await run('patterns', () => {
    let hits = matchRules(text, read.scripts);
    if (entities.phones.length === 0) hits = hits.filter((h) => h.id !== 'CUSTOMER_CARE_NUMBER');
    const ruleSignals = toSignals(hits, req.lang);
    const payeeName = qr?.payeeName ?? req.collect?.requesterName;
    const payeeUpi = qr?.payeeUpi ?? req.collect?.requesterUpi;
    const identity = analyzeIdentity({
      text,
      // links layer off (eval rules_only): no brand-vs-link or brand-vs-UPI judgements either
      entities: layerOn('links') ? entities : { ...entities, urls: [], upiIds: [] },
      ruleSignals,
      lang: req.lang,
      ...(payeeName ? { payeeName } : {}),
      ...(payeeUpi ? { payeeUpi } : {}),
    });
    entities.brands = identity.brands;
    const moneyLost = MONEY_LOST.test(normalizeText(req.collect?.note ?? ''));
    const collect: CollectAnalysis | undefined =
      req.kind === 'collect_request' && req.collect
        ? analyzeCollect(req.collect, text, req.lang, moneyLost)
        : undefined;
    const exclude = [
      ...entities.urls.flatMap((u) => (u.span ? [u.span] : [])),
      ...entities.upiIds.flatMap((u) => (u.span ? [u.span] : [])),
    ];
    const email: EmailAnalysis | undefined =
      req.kind === 'email' ? analyzeEmail(raw, text, req.lang, exclude) : undefined;
    if (email) {
      // sender-domain judgement replaces the link-only judgement for the same brand
      const byName = new Map(entities.brands.map((b) => [b.brand, b]));
      for (const b of email.brands) {
        const prev = byName.get(b.brand);
        byName.set(b.brand, prev && prev.mismatch && !b.mismatch ? prev : b);
      }
      entities.brands = [...byName.values()];
    }
    const screen: CollectScreen | null =
      req.kind === 'image' ? detectCollectScreen(text, entities, req.lang) : null;
    const chat: ChatAnalysis | undefined =
      req.kind === 'chat'
        ? analyzeChat(raw, text, (t) => scoreLive(t, req.lang).riskScore)
        : undefined;
    const contextSignals: Signal[] = [...(email?.signals ?? []), ...(screen?.signals ?? [])];
    if (chat?.escalation) {
      contextSignals.push({
        id: 'ESCALATION',
        weight: CATALOG.ESCALATION.weight,
        source: 'context',
        ...signalText('ESCALATION', req.lang),
        spans: chat.escalationSpans,
      });
    }
    return { ruleSignals, identity, collect, email, screen, chat, contextSignals };
  });
  const { ruleSignals, identity, collect, email, screen, chat, contextSignals } = patterns;
  const apk = ruleSignals.find((s) => s.id === 'APK_LINK');
  if (apk) entities.apkMentions = dedupeSpans([...entities.apkMentions, ...apk.spans]);

  // QR amount and payee belong to the payee's UPI finding
  if (qr?.payeeUpi) {
    const payee = entities.upiIds.find((u) => u.raw.toLowerCase() === qr.payeeUpi!.toLowerCase());
    if (
      payee &&
      qr.signals.some((s) => s.id === 'PREFILLED_AMOUNT') &&
      !payee.flags.includes('PREFILLED_AMOUNT')
    ) {
      payee.flags.push('PREFILLED_AMOUNT');
      payee.risk = Math.max(payee.risk, noisyOrRisk(payee.flags));
    }
  }
  entities.urls.forEach(rescoreUrl);
  const ind = indicatorPass(entities, opts.blocklist, req.lang, layerOn('indicators'));

  // ── model ──
  let prediction: ModelPrediction | null = null;
  let modelSig: Signal | null = null;
  // The classifier reads messages. A bare URL, UPI ID, phone number or QR payload is not one
  // (it scores a lone phone number as a likely scam), so those inputs skip the model layer.
  const messageLike =
    req.kind !== 'url' && req.kind !== 'upi_id' && req.kind !== 'phone' && req.kind !== 'qr';
  const model = layerOn('model') && messageLike ? await getModel() : null;
  if (model && text) {
    onStage?.({ stage: 'model', ms: 0, status: 'running' });
    const m0 = now();
    prediction = safePredict(model, modelText(text));
    emit({ stage: 'model', ms: round2(now() - m0), status: prediction ? 'done' : 'failed' });
    if (prediction) modelSig = modelSignal(text, prediction, req.lang);
  } else skip('model');
  signal?.throwIfAborted();

  const linkSignals = layerOn('links')
    ? [
        ...urlSignals(entities, req.lang),
        ...identity.signals.filter((s) => CATALOG[s.id].layer !== 'rules'),
      ]
    : [];
  const localSignals = mergeSignals([
    ...ruleSignals,
    ...identity.signals.filter((s) => CATALOG[s.id].layer === 'rules'),
    ...linkSignals,
    ...(qr?.signals ?? []),
    ...(collect?.signals ?? []),
    ...contextSignals,
    ...ind.signals,
    ...(modelSig ? [modelSig] : []),
  ]);
  // single-item inputs: the rules layer has no message text to judge (see FusionInput.rulesRelevant)
  const singleItem =
    req.kind === 'url' || req.kind === 'upi_id' || req.kind === 'phone' || qr?.qrKind === 'website';
  // A QR expected to be a payment that opens a non-official website is a warning sign in itself (M4.2).
  const websiteQrFloor =
    qr?.qrKind === 'website' && entities.urls.some((u) => !u.isOfficial) ? 40 : 0;
  const calibration = currentCalibration();
  const modelScore = prediction ? Math.round(100 * prediction.pScam) : null;
  const fuseWith = (signals: Signal[], ai: number | null) =>
    fuse({
      signals,
      entities,
      calibration,
      useLinks: layerOn('links'),
      indicators: ind.score,
      maxReports: ind.maxReports,
      model: modelScore,
      ai,
      contexts: identity.contexts,
      extraFloor: Math.max(collect?.floor ?? 0, websiteQrFloor),
      rulesRelevant: !singleItem,
    });
  const local = fuseWith(localSignals, null);

  // ── ai: opt-in, online, masked text only ──
  let ai: AiAnalyzeResponse | null = null;
  if (opts.cloudAI === true && layerOn('ai') && isOnline() && text) {
    onStage?.({ stage: 'ai', ms: 0, status: 'running' });
    const a0 = now();
    const localCat = chooseCategory(
      verdictOf(local.riskScore, calibration),
      localSignals,
      text,
      prediction,
    ).category;
    ai = await requestAiOpinion({
      text,
      kind: req.kind,
      lang: req.lang,
      ruleSignals: localSignals.filter((s) => s.weight > 0).map((s) => s.id),
      localCategory: localCat,
      localScore: local.riskScore,
      ...(signal ? { signal } : {}),
    }).catch(() => null);
    emit({ stage: 'ai', ms: round2(now() - a0), status: ai ? 'done' : 'failed' });
  } else skip('ai');
  signal?.throwIfAborted();

  // AI_FLAG signals are kept one per red flag (not merged)
  const signals = ai
    ? [...localSignals, ...aiSignals(ai, text, req.lang)].sort((a, b) => b.weight - a.weight)
    : localSignals;
  const fusion = ai ? fuseWith(signals, ai.likelihood) : local;
  const verdict = verdictOf(fusion.riskScore, calibration);
  const ruleChoice = chooseCategory(verdict, signals, text, prediction);
  // §8.4 step 1: the AI category wins when it agrees with the rules or the model
  const chosen =
    ai?.category &&
    verdict !== 'no_signs' &&
    (ai.category === ruleChoice.category || ai.category === prediction?.category)
      ? { category: ai.category, confidence: Math.round(ai.likelihood) / 100 }
      : ruleChoice;
  // a QR that opens a website is a phishing route when nothing more specific was found
  const category =
    qr?.qrKind === 'website' && chosen.category === 'other'
      ? 'phishing_link'
      : chosen.category === 'other' && ind.category
        ? ind.category
        : chosen.category;
  const categoryConfidence = chosen.confidence;

  // explanation: PIN truth for receive-with-PIN traps; QR payee (or "opens a website") always first
  const receiveTrap = verdict !== 'no_signs' && signals.some((s) => s.id === 'RECEIVE_WITH_PIN');
  const body = receiveTrap
    ? template('pinTruth', req.lang)
    : ai?.explanation && verdict !== 'no_signs'
      ? ai.explanation
      : qr?.lead && verdict !== 'no_signs' && category
        ? categoryText(category, req.lang).oneLiner
        : explain(verdict, category, signals, req.lang);
  // lookups (bare UPI ID, number or website): say what the bundled reports and the blocklist show
  let lookupLead: string | undefined;
  let lookupBody = body;
  if (req.kind === 'url' || req.kind === 'upi_id' || req.kind === 'phone') {
    const what = template(
      req.kind === 'url' ? 'whatUrl' : req.kind === 'upi_id' ? 'whatUpi' : 'whatPhone',
      req.lang,
    );
    const others = signals.some(
      (s) => s.weight > 0 && s.id !== 'KNOWN_INDICATOR' && s.id !== 'BLOCKLISTED',
    );
    if (ind.blocked) lookupLead = template('lookupBlocked', req.lang, { what });
    else if (ind.score !== null) {
      const cat = ind.category ?? category;
      lookupLead = template('lookupReported', req.lang, {
        what,
        reports: String(ind.maxReports),
        category: cat ? categoryText(cat, req.lang).name : '',
      });
    }
    if (lookupLead && !others) lookupBody = '';
    else if (!lookupLead && verdict === 'no_signs')
      lookupBody = template('lookupClean', req.lang, { what });
  }
  const explanation = [qr?.lead, lookupLead, lookupBody].filter(Boolean).join(' ');

  const result: AnalysisResult = {
    id: newId(),
    createdAt: new Date().toISOString(),
    kind: req.kind,
    lang: req.lang,
    detectedLang: read.detectedLang,
    text,
    verdict,
    riskScore: fusion.riskScore,
    severity: severityOf(fusion.riskScore, verdict),
    confidence:
      req.kind === 'image' && req.ocr && isWeakOcr(req.ocr)
        ? Math.min(0.6, confidenceOf(signals, fusion.rules, modelScore, verdict, text.length))
        : confidenceOf(signals, fusion.rules, modelScore, verdict, text.length),
    category,
    categoryConfidence,
    signals,
    claimVsReality: dedupeClaims([
      ...(collect?.claims ?? []),
      ...(qr?.claims ?? []),
      ...(screen?.claims ?? []),
      ...(email?.claims ?? []),
      ...identity.claims,
    ]),
    entities,
    layers: fusion.layers,
    explanation,
    actions: [],
    stages,
    aiUsed: ai !== null,
    offline: !links.networkUsed && ai === null,
    latencyMs: 0,
    engineVersion: ENGINE_VERSION,
    modelVersion: MODEL_VERSION,
  };
  if (ai) result.aiProvider = ai.provider;
  if (qr?.payload) result.qr = qr.payload;
  if (chat) result.chat = chat.risks;

  let actions: ActionId[];
  if (collect && verdict !== 'no_signs') actions = collect.actions;
  else if (screen && verdict !== 'no_signs') actions = [...COLLECT_ACTIONS];
  else {
    const userText = (result.chat ?? [])
      .filter((t) => t.sender === 'me')
      .map((t) => t.text)
      .join(' ');
    actions = chooseActions(verdict, category, signals, text, normalizeText(userText));
  }
  result.actions = actions;

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
