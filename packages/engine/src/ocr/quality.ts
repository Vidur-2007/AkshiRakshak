/**
 * Weak-OCR rule (SPEC_A_ENGINE.md §10): confidence below 55 or fewer than 15 characters.
 * The scan still runs; the UI shows "Hard to read" and offers typing (or, P2, cloud vision),
 * and analyze() caps its confidence at 0.6 for such images. Isomorphic (no DOM).
 */
import type { OcrResult } from '@akshi/contracts';

export const WEAK_OCR_CONFIDENCE = 55;
export const WEAK_OCR_MIN_CHARS = 15;

export function isWeakOcr(ocr: Pick<OcrResult, 'confidence' | 'text'>): boolean {
  return (
    ocr.confidence < WEAK_OCR_CONFIDENCE || ocr.text.replace(/\s/g, '').length < WEAK_OCR_MIN_CHARS
  );
}
