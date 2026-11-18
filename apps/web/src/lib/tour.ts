/**
 * Judge tour (SPEC_B_WEB.md §5.17, M12.3): a scripted run over the real screens with
 * bundled samples only, so it works offline. Each step opens a route, waits for an
 * element marked `data-tour="<target>"`, and the overlay rings it with a caption.
 */
import { create } from 'zustand';
import { SAMPLE_COLLECT_QUERY } from './collect';
import { QR_SAMPLE } from './qrSamples';
import type { ScanPrefillState } from '@/components/shell/paletteStore';
import { useAppStore } from './store';

export type TourStepId = 'kyc' | 'reveal' | 'collect' | 'qr' | 'proof' | 'elder';

export interface TourStep {
  id: TourStepId;
  /** value of the `data-tour` attribute to ring */
  target: string;
  /** where to go; `kyc` is the bundled fake KYC SMS text */
  to: (kyc: string) => { path: string; state?: ScanPrefillState };
  /** Elder mode on for this step (restored when the tour ends) */
  elder?: boolean;
}

/** §5.17 order: fake KYC → reveal → collect + PIN → QR x-ray → Proof → Elder STOP. */
export const TOUR_STEPS: readonly TourStep[] = [
  { id: 'kyc', target: 'scan-card', to: (kyc) => ({ path: '/scan', state: { prefill: kyc } }) },
  {
    id: 'reveal',
    target: 'verdict',
    to: (kyc) => ({ path: '/scan', state: { prefill: kyc, autoScan: true } }),
  },
  {
    id: 'collect',
    target: 'pin',
    to: () => ({ path: `/modules/collect?${SAMPLE_COLLECT_QUERY}` }),
  },
  {
    id: 'qr',
    target: 'qr-xray',
    to: () => ({ path: `/modules/qr-link?value=${encodeURIComponent(QR_SAMPLE)}` }),
  },
  { id: 'proof', target: 'proof-metrics', to: () => ({ path: '/proof' }) },
  {
    id: 'elder',
    target: 'elder-verdict',
    elder: true,
    to: (kyc) => ({ path: '/scan', state: { prefill: kyc, autoScan: true } }),
  },
];

/** Each step stays 10 s once its target is on screen (spec: 8–12 s). */
export const STEP_MS = 10_000;
/** Show the caption anyway if a target has not appeared by then. */
export const TARGET_WAIT_MS = 8_000;

/** The bundled sample the tour scans; the same text as the "Fake KYC SMS" chip. */
export const TOUR_SAMPLE_ID = 'sample-fake-kyc';

interface Saved {
  elderMode: boolean;
  voiceAuto: boolean;
}

interface TourState {
  active: boolean;
  index: number;
  saved: Saved | null;
  start(): void;
  next(): void;
  /** ends the tour (Skip, Finish, Escape) and restores Elder mode and voice */
  end(): void;
}

export const useTour = create<TourState>()((set, get) => ({
  active: false,
  index: 0,
  saved: null,
  start: () => {
    const { elderMode, voiceAuto, setElderMode } = useAppStore.getState();
    if (elderMode) setElderMode(false);
    set({ active: true, index: 0, saved: { elderMode, voiceAuto } });
  },
  next: () => {
    const { index } = get();
    if (index >= TOUR_STEPS.length - 1) get().end();
    else set({ index: index + 1 });
  },
  end: () => {
    const { saved } = get();
    if (saved) {
      const app = useAppStore.getState();
      app.setElderMode(saved.elderMode);
      app.setVoiceAuto(saved.voiceAuto);
    }
    set({ active: false, index: 0, saved: null });
  },
}));

/** Applies a step's Elder setting before its route opens. */
export function applyStepMode(step: TourStep): void {
  const app = useAppStore.getState();
  if (!!step.elder !== app.elderMode) app.setElderMode(!!step.elder);
}

/** Puts the caption above the target when the target sits in the lower part of the screen. */
export function captionAtTop(rect: { top: number; bottom: number } | null, vh: number): boolean {
  if (!rect) return false;
  const mid = (rect.top + rect.bottom) / 2;
  return mid > vh * 0.55;
}
