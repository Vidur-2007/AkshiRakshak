/**
 * Model stage (SPEC_A_ENGINE.md §7). Stub-safe: if @akshi/model resolves null or throws,
 * the model layer is unavailable and the scan continues.
 */
import type { Lang, ModelPrediction, Signal, Span, TextModel } from '@akshi/contracts';
import { loadModel } from '@akshi/model';
import { signalText } from './i18n';

let modelPromise: Promise<TextModel | null> | null = null;

export function getModel(): Promise<TextModel | null> {
  modelPromise ??= loadModel().catch(() => null);
  return modelPromise;
}

const WORD_CHAR = /[\p{L}\p{M}\p{N}]/u;

function expandToWord(text: string, s: { start: number; end: number }): Span {
  let { start, end } = s;
  while (start > 0 && WORD_CHAR.test(text[start - 1] ?? '')) start--;
  while (end < text.length && WORD_CHAR.test(text[end] ?? '')) end++;
  return { start, end, text: text.slice(start, end) };
}

/** Top contributions → one MODEL_PATTERN signal: merge near spans, keep the 6 strongest phrases. */
export function modelSignal(text: string, pred: ModelPrediction, lang: Lang): Signal | null {
  const scored: { start: number; end: number; value: number }[] = [];
  for (const c of pred.contributions) {
    if (c.value <= 0) continue;
    for (const s of c.spans) {
      if (s.start >= 0 && s.end <= text.length && s.end > s.start)
        scored.push({ start: s.start, end: s.end, value: c.value });
    }
  }
  if (!scored.length) return null;
  scored.sort((a, b) => a.start - b.start);
  const merged: { start: number; end: number; value: number }[] = [];
  for (const s of scored) {
    const last = merged.at(-1);
    if (last && s.start <= last.end + 1) {
      last.end = Math.max(last.end, s.end);
      last.value += s.value;
    } else merged.push({ ...s });
  }
  const top = merged
    .sort((a, b) => b.value - a.value)
    .slice(0, 6)
    .map((s) => expandToWord(text, s))
    .sort((a, b) => a.start - b.start);
  return {
    id: 'MODEL_PATTERN',
    weight: 0,
    source: 'model',
    ...signalText('MODEL_PATTERN', lang),
    spans: top,
  };
}
