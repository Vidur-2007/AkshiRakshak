/**
 * Weak-OCR detection for the screenshot flow (§5.7): low confidence or too little
 * text means we offer "Hard to read. Type the message instead?". Same rule as the
 * engine (SPEC_A_ENGINE.md §10: confidence < 55 or < 15 non-space characters), so
 * the UI says "Hard to read" exactly when analyze() caps its confidence.
 */
import type { OcrResult } from './engine';

export const MIN_OCR_CONFIDENCE = 55;
export const MIN_OCR_CHARS = 15;

export function isWeakOcr(ocr: Pick<OcrResult, 'text' | 'confidence'>): boolean {
  return (
    ocr.confidence < MIN_OCR_CONFIDENCE || ocr.text.replace(/\s/g, '').length < MIN_OCR_CHARS
  );
}

export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/bmp'];
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

export function acceptableImage(file: Pick<File, 'type' | 'size'>): boolean {
  return (
    (IMAGE_TYPES.includes(file.type) || file.type.startsWith('image/')) &&
    file.size <= MAX_IMAGE_BYTES
  );
}
