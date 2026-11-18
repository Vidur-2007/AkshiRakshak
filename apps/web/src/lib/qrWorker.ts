/// <reference lib="webworker" />
/**
 * jsQR fallback decoder, off the main thread (SPEC.md §4: BarcodeDetector first,
 * a small decoder in a worker otherwise). Receives RGBA pixels, replies with the
 * decoded string or null.
 */
import jsQR from 'jsqr';

export interface QrJob {
  id: number;
  width: number;
  height: number;
  data: ArrayBuffer;
}

export interface QrReply {
  id: number;
  text: string | null;
}

self.onmessage = (ev: MessageEvent<QrJob>) => {
  const { id, width, height, data } = ev.data;
  let text: string | null;
  try {
    const code = jsQR(new Uint8ClampedArray(data), width, height, {
      inversionAttempts: 'attemptBoth',
    });
    text = code?.data || null;
  } catch {
    text = null;
  }
  const reply: QrReply = { id, text };
  (self as unknown as Worker).postMessage(reply);
};
