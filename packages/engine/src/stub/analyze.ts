/**
 * Phase 0 stub of analyze() (SPEC_A_ENGINE.md §2.3): keyword signals with real
 * spans on the user's text; the rest is filled from the fixture that best
 * matches the input kind. Replaced by pipeline/analyze.ts in P1/P2.
 */
import {
  normalizeText,
  type AnalysisResult,
  type AnalyzeRequest,
  type ChatTurnRisk,
  type InputKind,
  type Lang,
  type LayerContribution,
  type LiveScore,
  type Severity,
  type StageTiming,
  type Verdict,
} from '@akshi/contracts';
import { ANALYSIS_FIXTURES, type AnalysisFixtureName } from '@akshi/contracts/fixtures';
import { loadCalibration, MODEL_VERSION } from '@akshi/model';
import { ENGINE_VERSION } from '../version';
import { extractEntities, keywordSignals, parseUpiUriStub } from './extract';
import { CATEGORY_TEXT } from './strings';

const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const round2 = (n: number): number => Math.round(n * 100) / 100;

function newId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  return c?.randomUUID
    ? c.randomUUID()
    : `scan-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function severityOf(score: number): Severity {
  if (score >= 85) return 'critical';
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  if (score >= 15) return 'low';
  return 'none';
}

function scoreFromCount(count: number): number {
  if (count <= 0) return 5;
  if (count === 1) return 45;
  if (count === 2) return 62;
  return Math.min(98, 72 + 6 * (count - 3));
}

function verdictOf(score: number): Verdict {
  const { thresholds } = loadCalibration();
  if (score >= thresholds.scam) return 'scam';
  if (score >= thresholds.suspicious) return 'suspicious';
  return 'no_signs';
}

export function scoreLiveStub(text: string, _lang?: Lang): LiveScore {
  const hits = keywordSignals(normalizeText(text));
  const riskScore = scoreFromCount(hits.count);
  return {
    riskScore,
    verdict: verdictOf(riskScore),
    topSignals: hits.signals
      .filter((s) => s.weight > 0)
      .slice(0, 3)
      .map((s) => s.id),
  };
}

function detectLang(text: string): AnalysisResult['detectedLang'] {
  const counts = { latn: 0, deva: 0, beng: 0, telu: 0 };
  for (const ch of text) {
    const c = ch.codePointAt(0) ?? 0;
    if (c >= 0x0900 && c <= 0x097f) counts.deva++;
    else if (c >= 0x0980 && c <= 0x09ff) counts.beng++;
    else if (c >= 0x0c00 && c <= 0x0c7f) counts.telu++;
    else if (/[a-z]/i.test(ch)) counts.latn++;
  }
  const total = counts.latn + counts.deva + counts.beng + counts.telu;
  if (total === 0) return 'other';
  const share = (n: number) => n / total;
  if (share(counts.deva) >= 0.7) return 'hi';
  if (share(counts.beng) >= 0.7) return 'bn';
  if (share(counts.telu) >= 0.7) return 'te';
  if (share(counts.latn) >= 0.7) return 'en';
  return 'mixed';
}

function inputText(req: AnalyzeRequest): string {
  switch (req.kind) {
    case 'url':
      return req.url ?? req.text ?? '';
    case 'upi_id':
      return req.upiId ?? req.text ?? '';
    case 'phone':
      return req.phone ?? req.text ?? '';
    case 'qr':
      return req.qrPayload ?? req.text ?? '';
    case 'image':
      return req.ocr?.text ?? req.text ?? '';
    case 'collect_request': {
      const c = req.collect;
      if (!c) return req.text ?? '';
      const who = [c.requesterName, c.requesterUpi ? `(${c.requesterUpi})` : '']
        .filter(Boolean)
        .join(' ');
      const parts = [
        `Collect request${who ? ` from ${who}` : ''}${c.amount !== undefined ? ` for ₹${c.amount.toLocaleString('en-IN')}` : ''}.`,
        c.note ? `Note: ${c.note}` : '',
        c.toldYouWillReceive ? 'They said you will receive money.' : '',
      ];
      return parts.filter(Boolean).join(' ');
    }
    default:
      return req.text ?? '';
  }
}

const KIND_FIXTURE: Partial<Record<InputKind, AnalysisFixtureName>> = {
  chat: 'analysis-chat',
  email: 'analysis-email',
  url: 'analysis-url',
  qr: 'analysis-qr',
  image: 'analysis-image',
  collect_request: 'analysis-collect',
};

function fixtureFor(kind: InputKind, verdict: Verdict): AnalysisResult {
  const name =
    KIND_FIXTURE[kind] ??
    (verdict === 'scam'
      ? 'analysis-scam-kyc'
      : verdict === 'suspicious'
        ? 'analysis-suspicious-job'
        : 'analysis-nosigns-otp');
  return ANALYSIS_FIXTURES[name];
}

function chatTurns(raw: string, text: string): ChatTurnRisk[] {
  const turns: ChatTurnRisk[] = [];
  let from = 0;
  const names: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const t = normalizeText(line);
    if (!t) continue;
    const start = text.indexOf(t, from);
    if (start < 0) continue;
    from = start + t.length;
    const name =
      /^(?:\[[^\]]+\]\s*|\d{1,2}\/\d{1,2}\/\d{2,4},?\s*\d{1,2}:\d{2}\s*-\s*)?([^:]{1,40}):/
        .exec(t)?.[1]
        ?.trim();
    if (name && !names.includes(name)) names.push(name);
    const sender: ChatTurnRisk['sender'] = !name
      ? 'unknown'
      : name === names[1] || /^(you|आप)$/i.test(name)
        ? 'me'
        : 'them';
    turns.push({
      index: turns.length,
      sender,
      text: t,
      risk: scoreLiveStub(t).riskScore,
      start,
      end: start + t.length,
    });
  }
  return turns;
}

export async function analyzeStub(
  req: AnalyzeRequest,
  onStage?: (s: StageTiming) => void,
): Promise<AnalysisResult> {
  const t0 = now();
  const signal = req.options?.signal;
  signal?.throwIfAborted();
  const stages: StageTiming[] = [];

  function run<T>(stage: StageTiming['stage'], enabled: boolean, fn: () => T): T | undefined {
    if (!enabled) {
      const s: StageTiming = { stage, ms: 0, status: 'skipped' };
      stages.push(s);
      onStage?.(s);
      return undefined;
    }
    onStage?.({ stage, ms: 0, status: 'running' });
    const s0 = now();
    const result = fn();
    const s: StageTiming = { stage, ms: round2(now() - s0), status: 'done' };
    stages.push(s);
    onStage?.(s);
    return result;
  }

  const raw = inputText(req);
  const text = run('read', true, () => normalizeText(raw)) ?? '';
  run('ocr', false, () => undefined); // OCR runs before analyze() via ocrImage()
  const entities = run('links', true, () => extractEntities(text)) ?? extractEntities(text);
  const qr = req.kind === 'qr' ? parseUpiUriStub(raw) : undefined;
  const hits = run('patterns', true, () => keywordSignals(text)) ?? keywordSignals(text);
  run('model', false, () => undefined); // @akshi/model stub has no model
  run('ai', false, () => undefined);
  signal?.throwIfAborted();

  const riskScore = scoreFromCount(hits.count);
  const verdict = verdictOf(riskScore);
  const fx = fixtureFor(req.kind, verdict);
  const category = verdict === 'no_signs' ? null : (hits.categories[0] ?? fx.category);
  const linkRisk = Math.max(0, ...entities.urls.map((u) => u.risk));
  const upiRisk = Math.max(0, ...entities.upiIds.map((u) => u.risk));
  const layers: LayerContribution[] = [
    { layer: 'rules', score: riskScore, share: 1, available: true },
    { layer: 'model', score: 0, share: 0, available: false },
    { layer: 'links', score: linkRisk, share: 0, available: entities.urls.length > 0 },
    { layer: 'upi', score: upiRisk, share: 0, available: entities.upiIds.length > 0 },
    { layer: 'indicators', score: 0, share: 0, available: false },
    { layer: 'ai', score: 0, share: 0, available: false },
  ];
  const reasons = hits.signals
    .filter((s) => s.weight > 0)
    .slice(0, 2)
    .map((s) => s.label.toLowerCase());
  const explanation =
    verdict === 'no_signs'
      ? 'No warning signs found. Still, never share your OTP or PIN with anyone.'
      : `${category ? CATEGORY_TEXT[category].oneLiner : 'This shows signs of a scam.'} We noticed: ${reasons.join(' and ')}.`;

  const result: AnalysisResult = {
    id: newId(),
    createdAt: new Date().toISOString(),
    kind: req.kind,
    lang: req.lang,
    detectedLang: detectLang(text),
    text,
    verdict,
    riskScore,
    severity: severityOf(riskScore),
    confidence:
      verdict === 'no_signs'
        ? text.length < 25
          ? 0.6
          : 0.7
        : Math.min(0.95, 0.6 + 0.1 * Math.min(hits.count, 3)),
    category,
    categoryConfidence: category ? Math.min(0.9, 0.5 + 0.1 * hits.count) : 0,
    signals: hits.signals,
    claimVsReality: verdict === 'no_signs' ? [] : fx.claimVsReality,
    entities,
    layers,
    explanation,
    actions: verdict === 'no_signs' ? ['no_action_needed'] : fx.actions,
    stages,
    aiUsed: false,
    offline: true,
    latencyMs: round2(now() - t0),
    engineVersion: ENGINE_VERSION,
    modelVersion: MODEL_VERSION,
  };
  if (qr) result.qr = qr;
  if (req.kind === 'chat') result.chat = chatTurns(raw, text);
  if (req.kind === 'image' && req.ocr && normalizeText(req.ocr.text) === req.ocr.text) {
    result.image = {
      width: req.ocr.width,
      height: req.ocr.height,
      boxes: req.ocr.boxes.map((b) => ({
        ...b,
        signalIds: hits.signals
          .filter((s) => s.spans.some((sp) => sp.start < b.end && b.start < sp.end))
          .map((s) => s.id),
      })),
    };
  }
  return result;
}
