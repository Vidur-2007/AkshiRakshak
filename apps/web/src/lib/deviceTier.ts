/**
 * Device tier (SPEC_B_WEB.md §3.4). Decides ShieldCore point count, blur layers,
 * Lenis, tilt effects and the 3D pixel-ratio cap.
 */
export type DeviceTier = 'high' | 'mid' | 'low';

export interface TierInput {
  cores?: number;
  /** navigator.deviceMemory in GB, when the browser exposes it */
  memoryGb?: number;
  saveData?: boolean;
  reducedMotion?: boolean;
}

export function computeTier({ cores, memoryGb, saveData, reducedMotion }: TierInput): DeviceTier {
  if (
    saveData === true ||
    reducedMotion === true ||
    (cores !== undefined && cores <= 4) ||
    (memoryGb !== undefined && memoryGb <= 4)
  ) {
    return 'low';
  }
  const coresHigh = cores !== undefined && cores >= 8;
  const memoryHigh = memoryGb === undefined || memoryGb >= 8;
  return coresHigh && memoryHigh ? 'high' : 'mid';
}

export interface TierSettings {
  /** ShieldCore instanced points; 0 = static poster image */
  shieldPoints: number;
  /** max simultaneously visible blurred layers */
  blurLayers: number;
  lenis: boolean;
  tilt: boolean;
  /** devicePixelRatio cap for 3D canvases */
  dprCap: number;
}

export const TIER_SETTINGS: Record<DeviceTier, TierSettings> = {
  high: { shieldPoints: 6000, blurLayers: 2, lenis: true, tilt: true, dprCap: 1.5 },
  mid: { shieldPoints: 2500, blurLayers: 2, lenis: true, tilt: false, dprCap: 1.25 },
  low: { shieldPoints: 0, blurLayers: 0, lenis: false, tilt: false, dprCap: 1 },
};

interface NavigatorHints {
  hardwareConcurrency?: number;
  deviceMemory?: number;
  connection?: { saveData?: boolean };
}

export function readTierInput(): TierInput {
  if (typeof window === 'undefined') return {};
  const nav = navigator as Navigator & NavigatorHints;
  let reducedMotion = false;
  try {
    reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    /* old browsers */
  }
  return {
    cores: nav.hardwareConcurrency || undefined,
    memoryGb: nav.deviceMemory,
    saveData: nav.connection?.saveData,
    reducedMotion,
  };
}

export function detectDeviceTier(): DeviceTier {
  return computeTier(readTierInput());
}
