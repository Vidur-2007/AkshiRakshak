import type { Calibration, TextModel } from '@akshi/contracts';
import calibrationJson from '../model/calibration.json';
import versionJson from '../model/version.json';
import { parseCalibration } from './calibration';
import { createModel } from './model';

/** Version of the trained model in model/scam-model.json (read from the small version.json, so it is sync). */
export const MODEL_VERSION: string = versionJson.version;

let loading: Promise<TextModel | null> | undefined;

/**
 * Loads the classifier once. The JSON is imported dynamically so bundlers put it in its own chunk.
 * Resolves null when the file is missing or is not a model this code understands; the engine then runs without
 * the model layer.
 */
export function loadModel(): Promise<TextModel | null> {
  loading ??= (async () => {
    try {
      const mod: { default?: unknown } = await import('../model/scam-model.json');
      return createModel(mod.default ?? mod);
    } catch {
      return null;
    }
  })();
  return loading;
}

/** Sync. Thresholds and fusion weights from model/calibration.json, or the spec defaults if that file is invalid. */
export function loadCalibration(): Calibration {
  return parseCalibration(calibrationJson);
}
