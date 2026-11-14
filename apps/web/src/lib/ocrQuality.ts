/**
 * Weak-OCR detection for the screenshot flow (§5.7): low confidence or too little
 * text means we offer "Hard to read. Type the message instead?".
 */
import type { OcrResult } from './engine';

export const MIN_OCR_CONFIDENCE = 60;
export const MIN_OCR_CHARS = 12;

export function isWeakOcr(ocr: Pick<OcrResult, 'text' | 'confidence'>): boolean {
  const letters = ocr.text.replace(/[\s\p{P}\p{S}]/gu, '').length;
  return ocr.confidence < MIN_OCR_CONFIDENCE || letters < MIN_OCR_CHARS;
}

export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/bmp'];
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

export function acceptableImage(file: Pick<File, 'type' | 'size'>): boolean {
  return (
    (IMAGE_TYPES.includes(file.type) || file.type.startsWith('image/')) &&
    file.size <= MAX_IMAGE_BYTES
  );
}
