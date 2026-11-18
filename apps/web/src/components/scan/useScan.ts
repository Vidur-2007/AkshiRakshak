import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import type { AnalysisResult } from '@/lib/engine';
import { loadEngine } from '@/lib/engineLoader';
import {
  buildRequest,
  runAnalysis,
  storeImage,
  storeResult,
  toTextKind,
  type RequestCore,
} from '@/lib/scan';
import { applyStage, initialTicker, withMinDuration, type TickerState } from '@/lib/scanTiming';
import { useAppStore } from '@/lib/store';

export interface AnalysisLocationState {
  /** true when we arrived straight from a scan, so the reveal plays */
  fresh?: boolean;
}

export interface RunExtras {
  /** screenshot behind an image scan, kept on this device for the overlay */
  image?: Blob;
}

/**
 * Runs one analysis with live stage events, keeps the ticker up for at least 400 ms
 * (never longer), and saves the result to history (which broadcasts it). Used for
 * inline results in the modules; useScan adds navigation to /scan/:id.
 */
export function useAnalysis() {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [ticker, setTicker] = useState<TickerState>(initialTicker);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const run = useCallback(
    async (core: RequestCore, extras: RunExtras = {}): Promise<AnalysisResult | null> => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const { lang, aiOptIn, online, setLastResultId } = useAppStore.getState();
      setFailed(false);
      setTicker(initialTicker());
      setBusy(true);
      try {
        const r = await withMinDuration(() =>
          runAnalysis(core, { lang, cloudAI: aiOptIn, online, signal: ctrl.signal }, (s) =>
            setTicker((prev) => applyStage(prev, s)),
          ),
        );
        if (ctrl.signal.aborted) return null;
        if (extras.image) await storeImage(r.id, extras.image);
        await storeResult(r);
        setLastResultId(r.id);
        setResult(r);
        return r;
      } catch {
        if (!ctrl.signal.aborted) setFailed(true);
        return null;
      } finally {
        if (abortRef.current === ctrl) setBusy(false);
      }
    },
    [],
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setResult(null);
    setFailed(false);
    setBusy(false);
  }, []);

  return { run, reset, busy, failed, ticker, result };
}

/** Quick Scan: analyse, then open /scan/:id with the reveal. */
export function useScan() {
  const navigate = useNavigate();
  const analysis = useAnalysis();
  const { run: runCore } = analysis;

  const runCoreAndOpen = useCallback(
    async (core: RequestCore, extras?: RunExtras) => {
      const r = await runCore(core, extras);
      if (!r) return;
      const state: AnalysisLocationState = { fresh: true };
      navigate(`/scan/${r.id}`, { state });
    },
    [runCore, navigate],
  );

  /** Free text from the scan box: the input kind is detected. */
  const run = useCallback(
    async (raw: string) => {
      if (!raw.trim()) return;
      const { lang } = useAppStore.getState();
      const { detectInputKind } = await loadEngine();
      const {
        options: _o,
        lang: _l,
        ...core
      } = buildRequest(raw, toTextKind(detectInputKind(raw).kind), {
        lang,
        cloudAI: false,
        online: false,
        blocklist: [],
      });
      return runCoreAndOpen(core);
    },
    [runCoreAndOpen],
  );

  return { ...analysis, run, runCore: runCoreAndOpen };
}
