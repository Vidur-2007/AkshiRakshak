import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { blocklistValues } from '@/lib/db';
import { analyze, detectInputKind } from '@/lib/engine';
import { buildRequest, storeResult, toTextKind } from '@/lib/scan';
import { applyStage, initialTicker, withMinDuration, type TickerState } from '@/lib/scanTiming';
import { useAppStore } from '@/lib/store';

export interface AnalysisLocationState {
  /** true when we arrived straight from a scan, so the reveal plays */
  fresh?: boolean;
}

/**
 * Runs a Quick Scan: analyze with live stage events, keep the ticker up for at least
 * 400 ms, save to history (and broadcast), then open /scan/:id.
 */
export function useScan() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [ticker, setTicker] = useState<TickerState>(initialTicker);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const run = useCallback(
    async (raw: string) => {
      if (!raw.trim()) return;
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const { lang, aiOptIn, online, setLastResultId } = useAppStore.getState();
      setFailed(false);
      setTicker(initialTicker());
      setBusy(true);
      try {
        const result = await withMinDuration(async () => {
          const blocklist = await blocklistValues();
          const kind = toTextKind(detectInputKind(raw).kind);
          const req = buildRequest(raw, kind, {
            lang,
            cloudAI: aiOptIn,
            online,
            blocklist,
            signal: ctrl.signal,
          });
          return analyze(req, (s) => setTicker((prev) => applyStage(prev, s)));
        });
        if (ctrl.signal.aborted) return;
        await storeResult(result);
        setLastResultId(result.id);
        const state: AnalysisLocationState = { fresh: true };
        navigate(`/scan/${result.id}`, { state });
      } catch {
        if (!ctrl.signal.aborted) setFailed(true);
      } finally {
        if (abortRef.current === ctrl) setBusy(false);
      }
    },
    [navigate],
  );

  return { run, busy, failed, ticker };
}
