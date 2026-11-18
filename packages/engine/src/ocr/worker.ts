/**
 * tesseract.js worker management (SPEC_A_ENGINE.md §10). Browser only — imported from
 * src/browser.ts, never from the isomorphic core.
 *
 * Everything is self-hosted under `/engine-assets/` (B's Vite config copies
 * packages/engine/assets/** there), so OCR works offline after the files are cached:
 *   /engine-assets/tesseract/worker.min.js
 *   /engine-assets/tesseract/tesseract-core-{relaxedsimd-lstm,simd-lstm,lstm}.wasm.js
 *   /engine-assets/tessdata/{eng,hin,tel,ben}.traineddata.gz
 * One worker is created lazily and reused; asking for different languages re-initialises it.
 */
import type { Lang } from '@akshi/contracts';
import type Tesseract from 'tesseract.js';

export const TESS_LANG: Readonly<Record<Lang, string>> = {
  en: 'eng',
  hi: 'hin',
  te: 'tel',
  bn: 'ben',
};

let assetBase = '/engine-assets';

/** Where the OCR files are served from (default `/engine-assets`, no trailing slash). */
export function setOcrAssetBase(base: string): void {
  assetBase = base.replace(/\/+$/, '');
}

export function ocrPaths(): { workerPath: string; corePath: string; langPath: string } {
  return {
    workerPath: `${assetBase}/tesseract/worker.min.js`,
    corePath: `${assetBase}/tesseract`,
    langPath: `${assetBase}/tessdata`,
  };
}

/** Tesseract language codes for the requested UI languages; English is always included. */
export function tessLangs(langs: readonly Lang[]): string[] {
  const codes = langs.map((l) => TESS_LANG[l]);
  return [...new Set([...codes, 'eng'])];
}

type ProgressFn = (p: number) => void;
let onProgress: ProgressFn | null = null;

/** Loading phases fill 0–0.5 of the bar, recognition fills 0.5–1. */
function mapProgress(m: { status: string; progress: number }): number {
  const p = Math.max(0, Math.min(1, m.progress || 0));
  if (m.status === 'recognizing text') return 0.5 + p / 2;
  if (m.status.includes('traineddata')) return 0.1 + p * 0.3;
  if (m.status.includes('core')) return p * 0.1;
  return 0.4 + p * 0.1;
}

let current: { key: string; worker: Promise<Tesseract.Worker> } | null = null;

export async function getOcrWorker(
  langs: readonly Lang[],
  progress?: ProgressFn,
): Promise<Tesseract.Worker> {
  onProgress = progress ?? null;
  const codes = tessLangs(langs);
  const key = codes.join('+');
  if (current?.key === key) return current.worker;
  if (current) {
    const prev = current.worker;
    current = {
      key,
      worker: prev.then(async (w) => {
        await w.reinitialize(codes.join('+'), 1);
        return w;
      }),
    };
    return current.worker;
  }
  const worker = (async () => {
    const { createWorker } = await import('tesseract.js');
    return createWorker(codes, 1 /* OEM.LSTM_ONLY */, {
      ...ocrPaths(),
      gzip: true,
      workerBlobURL: false,
      logger: (m: { status: string; progress: number }) => onProgress?.(mapProgress(m)),
    });
  })();
  current = { key, worker };
  worker.catch(() => {
    if (current?.worker === worker) current = null;
  });
  return worker;
}

/** Free the worker (e.g. when the screenshot screen closes). */
export async function terminateOcr(): Promise<void> {
  const c = current;
  current = null;
  if (c) await (await c.worker.catch(() => null))?.terminate();
}
