/**
 * @akshi/engine/browser — browser-only entry (OCR). SPEC.md §6.5.
 * PHASE 0 STUB: returns the analysis-image fixture's text and boxes after ~300 ms.
 * Real tesseract.js worker with self-hosted tessdata arrives in P3.
 */
import type { Lang, OcrResult } from '@akshi/contracts';
import { ANALYSIS_FIXTURES } from '@akshi/contracts/fixtures';

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function ocrImage(
  _image: Blob,
  langs: Lang[],
  onProgress?: (p: number) => void,
): Promise<OcrResult> {
  const fx = ANALYSIS_FIXTURES['analysis-image'];
  for (const p of [0, 0.35, 0.7]) {
    onProgress?.(p);
    await delay(100);
  }
  onProgress?.(1);
  const image = fx.image ?? { width: 0, height: 0, boxes: [] };
  return {
    text: fx.text,
    boxes: image.boxes.map(({ signalIds: _ids, ...box }) => box),
    width: image.width,
    height: image.height,
    confidence: 87,
    langs: langs.length > 0 ? langs : ['te', 'en'],
  };
}
