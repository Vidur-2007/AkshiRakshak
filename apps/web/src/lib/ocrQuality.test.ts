import { describe, expect, it } from 'vitest';
import { acceptableImage, isWeakOcr } from './ocrQuality';
import { fitSize, cameraErrorKind } from './qr';

describe('screenshot helpers', () => {
  it('flags low confidence or too little text', () => {
    expect(isWeakOcr({ text: 'Your account will be blocked today', confidence: 87 })).toBe(false);
    expect(isWeakOcr({ text: 'Your account will be blocked today', confidence: 40 })).toBe(true);
    expect(isWeakOcr({ text: '— · …  ok', confidence: 95 })).toBe(true);
  });

  it('accepts images up to 15 MB', () => {
    expect(acceptableImage({ type: 'image/png', size: 1000 })).toBe(true);
    expect(acceptableImage({ type: 'application/pdf', size: 1000 })).toBe(false);
    expect(acceptableImage({ type: 'image/jpeg', size: 20 * 1024 * 1024 })).toBe(false);
  });
});

describe('QR helpers', () => {
  it('downscales frames for the decoder', () => {
    expect(fitSize(1920, 1080)).toEqual({ width: 720, height: 405 });
    expect(fitSize(300, 200)).toEqual({ width: 300, height: 200 });
    expect(fitSize(0, 100)).toEqual({ width: 0, height: 0 });
  });

  it('classifies camera errors', () => {
    expect(cameraErrorKind({ name: 'NotAllowedError' })).toBe('denied');
    expect(cameraErrorKind({ name: 'NotFoundError' })).toBe('no-camera');
    expect(cameraErrorKind(new TypeError('x'))).toBe('unsupported');
    expect(cameraErrorKind(null)).toBe('other');
  });
});
