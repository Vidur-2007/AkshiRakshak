/**
 * Per-session counters for the privacy panel (§5.14): how many checks sent masked
 * text to the AI second opinion. Memory only; resets when the tab closes.
 */
import { create } from 'zustand';

interface SessionState {
  aiCalls: number;
  countAiCall(): void;
  /** `?demo=1` was opened in this tab: recording mode (sample order only) */
  demo: boolean;
}

export const useSession = create<SessionState>()((set) => ({
  aiCalls: 0,
  countAiCall: () => set((s) => ({ aiCalls: s.aiCalls + 1 })),
  demo: false,
}));
