import { describe, expect, it } from 'vitest';
import {
  applyStage,
  initialTicker,
  MIN_TICKER_MS,
  remainingTickerMs,
  tickerProgress,
  withMinDuration,
} from './scanTiming';

describe('StageTicker minimum duration', () => {
  it('keeps the ticker up for 400 ms and never longer', () => {
    expect(MIN_TICKER_MS).toBe(400);
    expect(remainingTickerMs(0)).toBe(400);
    expect(remainingTickerMs(120)).toBe(280);
    expect(remainingTickerMs(400)).toBe(0);
    expect(remainingTickerMs(950)).toBe(0);
    expect(remainingTickerMs(-1)).toBe(400);
  });

  it('waits only the remainder after fast work', async () => {
    let clock = 0;
    const slept: number[] = [];
    const result = await withMinDuration(
      async () => {
        clock += 30;
        return 'ok';
      },
      400,
      () => clock,
      async (ms) => {
        slept.push(ms);
        clock += ms;
      },
    );
    expect(result).toBe('ok');
    expect(slept).toEqual([370]);
    expect(clock).toBe(400);
  });

  it('adds no delay when the work already took longer', async () => {
    let clock = 0;
    const slept: number[] = [];
    await withMinDuration(
      async () => {
        clock += 700;
      },
      400,
      () => clock,
      async (ms) => {
        slept.push(ms);
      },
    );
    expect(slept).toEqual([]);
  });
});

describe('ticker state', () => {
  it('tracks stage events and progress', () => {
    let s = initialTicker();
    expect(tickerProgress(s)).toBe(0);
    s = applyStage(s, { stage: 'read', ms: 0, status: 'running' });
    expect(s.read).toBe('running');
    s = applyStage(s, { stage: 'read', ms: 1, status: 'done' });
    s = applyStage(s, { stage: 'model', ms: 0, status: 'skipped' });
    expect(tickerProgress(s)).toBe(2 / 5);
  });
});
