// STUB — owned by Laptop C; replaced on feat/data
import type { Calibration, TextModel } from '@akshi/contracts';

export const MODEL_VERSION: string = 'stub';

const DEFAULT_CALIBRATION: Calibration = {
  version: 'default',
  thresholds: { scam: 70, suspicious: 40 },
  fusion: { rules: 0.45, model: 0.35, links: 0.2 },
  aiBlend: 0.2,
};

/** Lazy; resolves null when no trained model is available (always, in the stub). */
export async function loadModel(): Promise<TextModel | null> {
  return null;
}

/** Sync; returns defaults when calibration.json is missing (always, in the stub). */
export function loadCalibration(): Calibration {
  const d = DEFAULT_CALIBRATION;
  return { ...d, thresholds: { ...d.thresholds }, fusion: { ...d.fusion } };
}
