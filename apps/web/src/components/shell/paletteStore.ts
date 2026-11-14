import { create } from 'zustand';

interface PaletteState {
  open: boolean;
  setOpen(open: boolean): void;
  toggle(): void;
}

/** Command palette visibility; runtime only. */
export const usePalette = create<PaletteState>()((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
  toggle: () => set((s) => ({ open: !s.open })),
}));

export function isMac(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /mac|iphone|ipad|ipod/i.test(navigator.platform || navigator.userAgent);
}

/** True for Ctrl+K (Windows/Linux) or Cmd+K (macOS). */
export function isPaletteShortcut(e: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey'>): boolean {
  return (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k';
}

/** Router state that pre-fills Quick Scan (palette "Paste and scan", share target). */
export interface ScanPrefillState {
  prefill: string;
  autoScan?: boolean;
}
