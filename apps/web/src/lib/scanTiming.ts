/**
 * StageTicker timing (SPEC_B_WEB.md §5.2, SPEC.md §1.3): the ticker stays visible
 * for at least 400 ms so it can be read, and never longer than that floor or the
 * real work. No fake delays.
 */
import type { StageTiming } from './engine';

export const MIN_TICKER_MS = 400;

/** How long to keep the ticker up after the work finished `elapsedMs` after it started. */
export function remainingTickerMs(elapsedMs: number, minMs = MIN_TICKER_MS): number {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return minMs;
  return Math.max(0, minMs - elapsedMs);
}

/** Runs `work`, then resolves no earlier than `minMs` after start. */
export async function withMinDuration<T>(
  work: () => Promise<T>,
  minMs = MIN_TICKER_MS,
  now: () => number = () => performance.now(),
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
): Promise<T> {
  const t0 = now();
  const result = await work();
  const wait = remainingTickerMs(now() - t0, minMs);
  if (wait > 0) await sleep(wait);
  return result;
}

export type TickerStage = StageTiming['stage'];
export type TickerStatus = StageTiming['status'] | 'pending';

/** Stages shown for text checks, in order (OCR only appears for screenshots). */
export const TEXT_STAGES: TickerStage[] = ['read', 'links', 'patterns', 'model', 'ai'];

export type TickerState = Record<TickerStage, TickerStatus>;

export function initialTicker(): TickerState {
  return {
    read: 'pending',
    ocr: 'pending',
    links: 'pending',
    patterns: 'pending',
    model: 'pending',
    ai: 'pending',
  };
}

export function applyStage(state: TickerState, ev: StageTiming): TickerState {
  return { ...state, [ev.stage]: ev.status };
}

/** 0–1 progress for the Scan button ring: finished stages over shown stages. */
export function tickerProgress(state: TickerState, shown: TickerStage[] = TEXT_STAGES): number {
  if (!shown.length) return 0;
  const finished = shown.filter(
    (s) => state[s] === 'done' || state[s] === 'skipped' || state[s] === 'failed',
  );
  return finished.length / shown.length;
}
