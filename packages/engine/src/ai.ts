/**
 * AI second opinion, engine side (SPEC_A_ENGINE.md §8.2, §12.1). Opt-in (`options.cloudAI`),
 * online only, masked text only. The server validates the model output; this module validates
 * it again (never trust the network) and maps red-flag quotes back to spans in the original text.
 */
import {
  type AiAnalyzeRequest,
  type AiAnalyzeResponse,
  type InputKind,
  type Lang,
  type ScamCategory,
  type Signal,
  type SignalId,
  type Span,
} from '@akshi/contracts';
import { signalText } from './i18n';
import { maskPII } from './mask';
import { postJson } from './net';
import { netSchemas } from './schemas-lazy';

/** Server tries Groq then Gemini with 8 s each; leave room for both. */
export const AI_CLIENT_TIMEOUT_MS = 20_000;
/** Display weight for AI_FLAG signals (the AI layer itself is blended in fusion, not in rules). */
export const AI_FLAG_WEIGHT = 0.25;

export const isOnline = (): boolean =>
  (globalThis as { navigator?: { onLine?: boolean } }).navigator?.onLine !== false;

export interface AiInput {
  text: string;
  kind: InputKind;
  lang: Lang;
  ruleSignals: readonly SignalId[];
  localCategory: ScamCategory | null;
  localScore: number;
  signal?: AbortSignal;
}

export async function requestAiOpinion(input: AiInput): Promise<AiAnalyzeResponse | null> {
  const body: AiAnalyzeRequest = {
    maskedText: maskPII(input.text).masked.slice(0, 4000),
    kind: input.kind,
    lang: input.lang,
    ruleSignals: [...new Set(input.ruleSignals)],
    localCategory: input.localCategory,
    localScore: Math.max(0, Math.min(100, Math.round(input.localScore))),
  };
  const raw = await postJson('/api/ai/analyze', body, {
    timeoutMs: AI_CLIENT_TIMEOUT_MS,
    ...(input.signal ? { signal: input.signal } : {}),
  });
  if (raw === null) return null;
  const parsed = (await netSchemas()).AiAnalyzeResponseSchema.safeParse(raw);
  if (!parsed.success) return null;
  // the server already keeps only exact quotes; re-check against what we sent
  const redFlags = parsed.data.redFlags.filter((f) => f.quote && body.maskedText.includes(f.quote));
  return { ...parsed.data, redFlags };
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
/** What each mask tag can stand for in the original text (escaped tag → pattern). */
const TAG_PATTERNS: Readonly<Record<string, string>> = {
  PHONE: String.raw`(?:\+?91[\s-]?)?\d[\d\s-]{6,14}\d`,
  UPI_ID: String.raw`[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z][a-zA-Z0-9]{1,63}`,
  EMAIL: String.raw`[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}`,
  NUMBER: String.raw`\d[\d\s-]{7,22}\d`,
  ID_NUMBER: String.raw`(?:[A-Z]{5}\d{4}[A-Z]|\d{4}[\s-]?\d{4}[\s-]?\d{4})`,
  NAME: String.raw`\p{L}[\p{L}\p{M}]*`,
  PATH: String.raw`\S*`,
};
const TAG = /\\\[(PHONE|UPI_ID|EMAIL|NUMBER|ID_NUMBER|NAME|PATH)\\\]/g;

/**
 * Find an AI quote (taken from the masked text) in the original text. Mask tags such as
 * [PHONE] match whatever was hidden; whitespace is flexible.
 */
export function findQuote(text: string, quote: string): Span | null {
  const q = quote.trim();
  if (!q) return null;
  const direct = text.indexOf(q);
  if (direct >= 0) return { start: direct, end: direct + q.length, text: q };
  const pattern = escapeRe(q)
    .replace(/\s+/g, '\\s+')
    .replace(TAG, (_m, tag: string) => `(?:${TAG_PATTERNS[tag] ?? '\\S+'})`);
  let m: RegExpExecArray | null;
  try {
    m = new RegExp(pattern, 'iu').exec(text);
  } catch {
    m = null; // a quote that does not form a valid pattern cannot be located
  }
  return m ? { start: m.index, end: m.index + m[0].length, text: m[0] } : null;
}

/** One AI_FLAG signal per red flag (SPEC_A §5.2), with the AI's reason as the detail. */
export function aiSignals(resp: AiAnalyzeResponse, text: string, lang: Lang): Signal[] {
  const base = signalText('AI_FLAG', lang);
  return resp.redFlags.map((f) => {
    const span = findQuote(text, f.quote);
    return {
      id: 'AI_FLAG' as const,
      weight: AI_FLAG_WEIGHT,
      source: 'ai' as const,
      label: base.label,
      detail: f.reason || base.detail,
      spans: span ? [span] : [],
    };
  });
}
