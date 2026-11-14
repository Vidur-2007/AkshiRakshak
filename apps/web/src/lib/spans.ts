/**
 * Turns signal spans into renderable text segments (SPEC_B_WEB.md §5.3 HighlightedText).
 * Overlapping or touching spans merge into one flagged range; the range lists every
 * signal that touches it, so one popover can explain all of them.
 */
import type { Signal } from './engine';

export interface FlaggedRange {
  start: number;
  end: number;
  /** signals with at least one span inside this range, strongest first */
  signals: Signal[];
  /** strongest positive weight in the range (negative if only reassuring signals) */
  weight: number;
  /** 0 = strongest range; drives the underline draw order */
  rank: number;
}

export type Segment =
  | { kind: 'plain'; start: number; end: number; text: string }
  | { kind: 'flag'; start: number; end: number; text: string; range: FlaggedRange };

interface Interval {
  start: number;
  end: number;
  signal: Signal;
}

/** Valid intervals only: clamped to the text, non-empty. */
function intervals(textLength: number, signals: Signal[]): Interval[] {
  const out: Interval[] = [];
  for (const signal of signals) {
    for (const span of signal.spans) {
      const start = Math.max(0, Math.min(textLength, Math.floor(span.start)));
      const end = Math.max(0, Math.min(textLength, Math.floor(span.end)));
      if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
        out.push({ start, end, signal });
      }
    }
  }
  return out.sort((a, b) => a.start - b.start || b.end - a.end);
}

function strongest(signals: Signal[]): number {
  const positive = signals.filter((s) => s.weight > 0).map((s) => s.weight);
  if (positive.length) return Math.max(...positive);
  return Math.min(...signals.map((s) => s.weight));
}

/** Merges overlapping or touching spans into flagged ranges, ranked by weight. */
export function mergeSpans(textLength: number, signals: Signal[]): FlaggedRange[] {
  const merged: { start: number; end: number; signals: Signal[] }[] = [];
  for (const iv of intervals(textLength, signals)) {
    const last = merged.at(-1);
    if (last && iv.start <= last.end) {
      last.end = Math.max(last.end, iv.end);
      if (!last.signals.includes(iv.signal)) last.signals.push(iv.signal);
    } else {
      merged.push({ start: iv.start, end: iv.end, signals: [iv.signal] });
    }
  }
  const ranges: FlaggedRange[] = merged.map((r) => ({
    ...r,
    signals: [...r.signals].sort((a, b) => b.weight - a.weight),
    weight: strongest(r.signals),
    rank: 0,
  }));
  [...ranges]
    .sort((a, b) => b.weight - a.weight || a.start - b.start)
    .forEach((r, i) => {
      r.rank = i;
    });
  return ranges;
}

/** Splits the whole text into plain and flagged segments, in order. */
export function buildSegments(text: string, signals: Signal[]): Segment[] {
  const segments: Segment[] = [];
  let pos = 0;
  for (const range of mergeSpans(text.length, signals)) {
    if (range.start > pos) {
      segments.push({
        kind: 'plain',
        start: pos,
        end: range.start,
        text: text.slice(pos, range.start),
      });
    }
    segments.push({
      kind: 'flag',
      start: range.start,
      end: range.end,
      text: text.slice(range.start, range.end),
      range,
    });
    pos = range.end;
  }
  if (pos < text.length)
    segments.push({ kind: 'plain', start: pos, end: text.length, text: text.slice(pos) });
  return segments;
}

export type SpanTone = 'scam' | 'warn' | 'safe' | 'ai';

/** Underline colour: risk colours by weight; --ai for AI-contributed ranges. */
export function rangeTone(range: Pick<FlaggedRange, 'weight' | 'signals'>): SpanTone {
  if (range.weight < 0) return 'safe';
  const top = range.signals.find((s) => s.weight === range.weight);
  if (top?.source === 'ai') return 'ai';
  return range.weight >= 0.25 ? 'scam' : 'warn';
}
