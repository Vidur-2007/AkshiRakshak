/**
 * QR decoding for the scanner sheet and image uploads (§5.6). Uses the browser's
 * BarcodeDetector when it supports QR codes, else jsQR in a worker.
 */
import type { QrJob, QrReply } from './qrWorker';

interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource | ImageBitmap | ImageData): Promise<DetectedBarcode[]>;
}
interface BarcodeDetectorCtor {
  new (opts: { formats: string[] }): BarcodeDetectorLike;
  getSupportedFormats?: () => Promise<string[]>;
}

let detector: Promise<BarcodeDetectorLike | null> | null = null;

/** The native detector, or null where it is missing or lacks QR support. */
export function nativeDetector(): Promise<BarcodeDetectorLike | null> {
  if (detector) return detector;
  detector = (async () => {
    const Ctor = (globalThis as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
    if (!Ctor) return null;
    try {
      const formats = (await Ctor.getSupportedFormats?.()) ?? ['qr_code'];
      return formats.includes('qr_code') ? new Ctor({ formats: ['qr_code'] }) : null;
    } catch {
      return null;
    }
  })();
  return detector;
}

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, (text: string | null) => void>();

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('./qrWorker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (ev: MessageEvent<QrReply>) => {
    pending.get(ev.data.id)?.(ev.data.text);
    pending.delete(ev.data.id);
  };
  return worker;
}

/** Decodes pixels with jsQR in the worker. */
export function decodeImageData(img: ImageData): Promise<string | null> {
  return new Promise((resolve) => {
    const id = nextId++;
    pending.set(id, resolve);
    const job: QrJob = {
      id,
      width: img.width,
      height: img.height,
      data: img.data.buffer as ArrayBuffer,
    };
    getWorker().postMessage(job, [job.data]);
  });
}

/** Max edge for frames sent to jsQR: enough for phone-screen QRs, cheap to scan. */
export const SCAN_EDGE = 720;

export function fitSize(w: number, h: number, max = SCAN_EDGE): { width: number; height: number } {
  if (w <= 0 || h <= 0) return { width: 0, height: 0 };
  const scale = Math.min(1, max / Math.max(w, h));
  return { width: Math.round(w * scale), height: Math.round(h * scale) };
}

function pixels(
  source: CanvasImageSource,
  w: number,
  h: number,
  canvas?: HTMLCanvasElement,
): ImageData | null {
  const { width, height } = fitSize(w, h);
  if (!width || !height) return null;
  const c = canvas ?? document.createElement('canvas');
  c.width = width;
  c.height = height;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height);
}

/** One frame from the camera. */
export async function decodeVideoFrame(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
): Promise<string | null> {
  if (video.readyState < 2 || !video.videoWidth) return null;
  const native = await nativeDetector();
  if (native) {
    try {
      return (await native.detect(video))[0]?.rawValue || null;
    } catch {
      /* fall through to jsQR */
    }
  }
  const img = pixels(video, video.videoWidth, video.videoHeight, canvas);
  return img ? decodeImageData(img) : null;
}

/** A QR in an uploaded image. */
export async function decodeImageFile(file: Blob): Promise<string | null> {
  const bitmap = await createImageBitmap(file);
  try {
    const native = await nativeDetector();
    if (native) {
      try {
        const hit = (await native.detect(bitmap))[0]?.rawValue;
        if (hit) return hit;
      } catch {
        /* fall through */
      }
    }
    const img = pixels(bitmap, bitmap.width, bitmap.height);
    return img ? decodeImageData(img) : null;
  } finally {
    bitmap.close();
  }
}

export type CameraError = 'denied' | 'no-camera' | 'unsupported' | 'other';

export function cameraErrorKind(err: unknown): CameraError {
  const name = (err as { name?: string } | null)?.name;
  if (name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError')
    return 'denied';
  if (
    name === 'NotFoundError' ||
    name === 'OverconstrainedError' ||
    name === 'DevicesNotFoundError'
  )
    return 'no-camera';
  if (name === 'TypeError' || name === 'NotSupportedError') return 'unsupported';
  return 'other';
}

export function cameraSupported(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
}

interface TorchCapabilities extends MediaTrackCapabilities {
  torch?: boolean;
}

export function torchSupported(track: MediaStreamTrack | undefined): boolean {
  try {
    return !!(track?.getCapabilities?.() as TorchCapabilities | undefined)?.torch;
  } catch {
    return false;
  }
}

export async function setTorch(track: MediaStreamTrack, on: boolean): Promise<boolean> {
  try {
    await track.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] });
    return true;
  } catch {
    return false;
  }
}
