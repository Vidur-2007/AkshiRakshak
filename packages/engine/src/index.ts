/**
 * @akshi/engine — public API (SPEC.md §6.5). Isomorphic: no DOM APIs here.
 * PHASE 0 STUB: behaviour per SPEC_A_ENGINE.md §2.3; signatures are final.
 */
import {
  HealthResponseSchema,
  normalizeText,
  type ActionId,
  type AnalysisResult,
  type AnalyzeRequest,
  type AssistantAnswer,
  type IndicatorMatch,
  type InputKind,
  type Lang,
  type LiveScore,
  type ScamCategory,
  type SignalId,
  type StageTiming,
  type UpiPayload,
  type UrlFinding,
} from '@akshi/contracts';
import { FAQ } from '@akshi/content';
import { loadModel } from '@akshi/model';
import { getJson } from './net';
import { analyzeStub, scoreLiveStub } from './stub/analyze';
import { lookupIndicatorStub, parseUpiUriStub, UPI_ID_RE, urlFinding } from './stub/extract';
import { ACTION_TEXT, CATEGORY_TEXT, SIGNAL_TEXT } from './stub/strings';

export { ENGINE_VERSION } from './version';
export { setApiBase } from './net';

export function analyze(
  req: AnalyzeRequest,
  onStage?: (s: StageTiming) => void,
): Promise<AnalysisResult> {
  return analyzeStub(req, onStage);
}

/** Sync, rules only, < 5 ms per 1,000 chars. */
export function scoreLive(text: string, lang?: Lang): LiveScore {
  return scoreLiveStub(text, lang);
}

export function detectInputKind(raw: string): { kind: InputKind; confidence: number } {
  const t = raw.trim();
  if (/^upi:\/\//i.test(t)) return { kind: 'qr', confidence: 0.99 };
  const single = !/\s/.test(t);
  if (single && new RegExp(`^${UPI_ID_RE.source}$`).test(t))
    return { kind: 'upi_id', confidence: 0.95 };
  if (
    single &&
    /^(?:https?:\/\/|www\.)\S+$|^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}(?:\/\S*)?$/i.test(t)
  ) {
    return { kind: 'url', confidence: 0.9 };
  }
  const digits = t.replace(/[\s-]/g, '');
  if (/^(?:\+?91)?[6-9]\d{9}$|^18[06]0\d{7}$/.test(digits))
    return { kind: 'phone', confidence: 0.9 };
  const lines = t.split(/\r?\n/);
  const waLines = lines.filter((l) =>
    /^\[\d{1,2}\/\d{1,2}\/\d{2,4},? \d{1,2}:\d{2}[^\]]*\] [^:]+:|^\d{1,2}\/\d{1,2}\/\d{2,4},? \d{1,2}:\d{2}\s?(?:[ap]m)? - [^:]+:/i.test(
      l,
    ),
  ).length;
  const nameLines = lines.filter((l) => /^[A-Za-z\u0904-\u0D7F][^:]{0,30}:\s/.test(l)).length;
  if (waLines >= 2 || nameLines >= 3) return { kind: 'chat', confidence: waLines >= 2 ? 0.9 : 0.7 };
  if (/^from:/im.test(t) && /^subject:/im.test(t)) return { kind: 'email', confidence: 0.9 };
  return { kind: 'message', confidence: 0.6 };
}

export function parseUpiUri(raw: string): UpiPayload {
  return parseUpiUriStub(raw);
}

export async function inspectUrl(
  url: string,
  _opts?: { expand?: boolean; domainAge?: boolean; signal?: AbortSignal },
): Promise<UrlFinding> {
  return urlFinding(normalizeText(url));
}

const MASKS: [RegExp, string | ((m: string, ...g: string[]) => string)][] = [
  [/\bhttps?:\/\/[^\s]+/gi, (m) => `https://${urlFinding(m).registrableDomain}/[PATH]`],
  [/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '[EMAIL]'],
  [UPI_ID_RE, '[UPI_ID]'],
  [/\b\d{4}\s?\d{4}\s?\d{4}\b/g, '[ID_NUMBER]'],
  [/\b[A-Z]{5}\d{4}[A-Z]\b/g, '[ID_NUMBER]'],
  [/(?:\+?91[\s-]?)?\b[6-9]\d{4}[\s-]?\d{5}\b|\b18[06]0[\s-]?\d{3}[\s-]?\d{4}\b/g, '[PHONE]'],
  [/\b\d{9,18}\b/g, '[NUMBER]'],
  [/\b(Dear|Mr\.?|Mrs\.?|Ms\.?|Shri|Smt\.?)\s+[A-Z][a-z]+/g, (_m, s = '') => `${s} [NAME]`],
  [/(श्री|प्रिय)\s+[ऀ-ॿ]+/g, (_m, s = '') => `${s} [NAME]`],
];

export function maskPII(text: string): { masked: string; replacements: number } {
  let replacements = 0;
  let masked = text;
  for (const [re, rep] of MASKS) {
    masked = masked.replace(re, (...args: string[]) => {
      replacements++;
      return typeof rep === 'string' ? rep : rep(args[0] ?? '', ...args.slice(1));
    });
  }
  return { masked, replacements };
}

export function lookupIndicator(value: string): IndicatorMatch | null {
  return lookupIndicatorStub(value);
}

export async function askAssistant(
  question: string,
  lang: Lang,
  _opts?: { online?: boolean; signal?: AbortSignal },
): Promise<AssistantAnswer> {
  const words = new Set(
    normalizeText(question)
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w.length > 2),
  );
  let best = FAQ[0];
  let bestScore = -1;
  for (const item of FAQ) {
    const hay = `${item.q[lang] ?? ''} ${item.q.en} ${item.tags.join(' ')}`.toLowerCase();
    const score = [...words].filter((w) => hay.includes(w)).length;
    if (score > bestScore) {
      best = item;
      bestScore = score;
    }
  }
  if (!best)
    return {
      answer: 'Call 1930 or visit cybercrime.gov.in for help.',
      sources: [],
      mode: 'offline',
    };
  return { answer: best.a[lang] ?? best.a.en, sources: [best.id], mode: 'offline' };
}

export function signalText(id: SignalId, _lang: Lang): { label: string; detail: string } {
  return { ...SIGNAL_TEXT[id] };
}

export function categoryText(c: ScamCategory, _lang: Lang): { name: string; oneLiner: string } {
  return { ...CATEGORY_TEXT[c] };
}

export function actionText(
  a: ActionId,
  _lang: Lang,
): { label: string; body: string; href?: string } {
  return { ...ACTION_TEXT[a] };
}

/** Loads model + lexicons. */
export async function warmup(): Promise<void> {
  await loadModel();
}

export async function apiHealth(): Promise<{ online: boolean; ai: boolean }> {
  const res = HealthResponseSchema.safeParse(await getJson('/api/health', { timeoutMs: 2000 }));
  if (!res.success) return { online: false, ai: false };
  return { online: true, ai: res.data.ai.groq || res.data.ai.gemini };
}
