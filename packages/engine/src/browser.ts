/**
 * @akshi/engine/browser — browser-only entry (OCR). SPEC.md §6.5, SPEC_A_ENGINE.md §10.
 *
 * ocrImage: downscales images wider than 1600 px, runs tesseract.js in a reused web worker with
 * self-hosted worker, core and tessdata files (see src/ocr/worker.ts), reports progress 0–1, and
 * returns word boxes whose start/end index the normalised OCR text — pass the result as
 * `analyze({ kind: 'image', ocr })` and each box gets the ids of the signals that overlap it.
 * Box coordinates are in the OcrResult's own width × height (the downscaled image).
 */
import { normalizeText, type Lang, type OcrBox, type OcrResult } from '@akshi/contracts';
import { getOcrWorker } from './ocr/worker';

export { setOcrAssetBase, terminateOcr } from './ocr/worker';

export const MAX_OCR_WIDTH = 1600;

interface TessWord {
  text: string;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}
interface TessPage {
  text?: string;
  confidence?: number;
  blocks?: { paragraphs?: { lines?: { words?: TessWord[] }[] }[] }[] | null;
}

/**
 * Builds the normalised OCR text word by word so every box keeps exact offsets.
 * Normalising each word and joining with one space equals normalizeText() of the whole text.
 */
export function buildOcrResult(
  page: TessPage,
  width: number,
  height: number,
  langs: Lang[],
): OcrResult {
  let text = '';
  const boxes: OcrBox[] = [];
  for (const block of page.blocks ?? []) {
    for (const para of block.paragraphs ?? []) {
      for (const line of para.lines ?? []) {
        for (const w of line.words ?? []) {
          const t = normalizeText(w.text ?? '');
          if (!t) continue;
          if (text) text += ' ';
          const start = text.length;
          text += t;
          boxes.push({
            text: t,
            x: w.bbox.x0,
            y: w.bbox.y0,
            w: w.bbox.x1 - w.bbox.x0,
            h: w.bbox.y1 - w.bbox.y0,
            start,
            end: start + t.length,
          });
        }
      }
    }
  }
  // Pages without layout blocks still yield text (no boxes).
  if (!boxes.length && page.text) text = normalizeText(page.text);
  return {
    text,
    boxes,
    width,
    height,
    confidence: Math.round(Math.max(0, Math.min(100, page.confidence ?? 0))),
    langs,
  };
}

/** Scale factor so the image is at most MAX_OCR_WIDTH wide (never upscales). */
export function downscaleSize(
  width: number,
  height: number,
): { width: number; height: number; scaled: boolean } {
  if (width <= MAX_OCR_WIDTH) return { width, height, scaled: false };
  const k = MAX_OCR_WIDTH / width;
  return { width: MAX_OCR_WIDTH, height: Math.round(height * k), scaled: true };
}

async function prepareImage(image: Blob): Promise<{ source: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(image);
  const size = downscaleSize(bitmap.width, bitmap.height);
  if (!size.scaled) {
    bitmap.close?.();
    return { source: image, ...size };
  }
  let blob: Blob;
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(size.width, size.height);
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, size.width, size.height);
    blob = await canvas.convertToBlob({ type: 'image/png' });
  } else {
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, size.width, size.height);
    blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'),
    );
  }
  bitmap.close?.();
  return { source: blob, ...size };
}

export async function ocrImage(
  image: Blob,
  langs: Lang[],
  onProgress?: (p: number) => void,
): Promise<OcrResult> {
  const use: Lang[] = langs.length ? langs : ['en'];
  onProgress?.(0);
  const { source, width, height } = await prepareImage(image);
  const worker = await getOcrWorker(use, onProgress);
  const { data } = await worker.recognize(source, {}, { text: true, blocks: true });
  onProgress?.(1);
  return buildOcrResult(data as TessPage, width, height, use);
}
