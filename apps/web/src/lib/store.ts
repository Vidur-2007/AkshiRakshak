/**
 * App state (SPEC_B_WEB.md §2.3). Preferences persist to localStorage through a
 * storage wrapper that never throws; runtime fields are never persisted.
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { detectDeviceTier, type DeviceTier } from './deviceTier';
import type { Lang } from './engine';
import { UI_LANGS as LANGS } from './langs';
import { safeLocalStorage } from './safeStorage';
import { isThemePref, type ThemePref } from './theme';
import { useSession } from './session';

export interface TrustedContact {
  name: string;
  phone: string;
}

export interface PersistedPrefs {
  lang: Lang;
  elderMode: boolean;
  /** AI second opinion; off unless the user turns it on */
  aiOptIn: boolean;
  voiceAuto: boolean;
  haptics: boolean;
  /** stored on this device only */
  trustedContact: TrustedContact | null;
  onboarded: boolean;
  /** day / night / follow the phone */
  theme: ThemePref;
}

export interface RuntimeState {
  deviceTier: DeviceTier;
  online: boolean;
  lastResultId: string | null;
}

export interface Actions {
  setLang(lang: Lang): void;
  setElderMode(on: boolean): void;
  toggleElderMode(): void;
  setAiOptIn(on: boolean): void;
  setVoiceAuto(on: boolean): void;
  setHaptics(on: boolean): void;
  setTrustedContact(contact: TrustedContact | null): void;
  setOnboarded(on: boolean): void;
  setTheme(theme: ThemePref): void;
  setOnline(online: boolean): void;
  setDeviceTier(tier: DeviceTier): void;
  setLastResultId(id: string | null): void;
}

export type AppState = PersistedPrefs & RuntimeState & Actions;

export function isLang(value: unknown): value is Lang {
  return typeof value === 'string' && (LANGS as readonly string[]).includes(value);
}

/** First visit: use the browser language when we support it, else English. */
export function initialLang(languages: readonly string[] = browserLanguages()): Lang {
  for (const l of languages) {
    const code = l.toLowerCase().split('-')[0];
    if (isLang(code)) return code;
  }
  return 'en';
}

function browserLanguages(): readonly string[] {
  if (typeof navigator === 'undefined') return [];
  return navigator.languages?.length ? navigator.languages : [navigator.language];
}

export const DEFAULT_PREFS: PersistedPrefs = {
  lang: 'en',
  elderMode: false,
  aiOptIn: false,
  voiceAuto: false,
  haptics: true,
  trustedContact: null,
  onboarded: false,
  theme: 'system',
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      ...DEFAULT_PREFS,
      lang: initialLang(),
      deviceTier: detectDeviceTier(),
      online: typeof navigator === 'undefined' ? true : navigator.onLine,
      lastResultId: null,

      setLang: (lang) => set({ lang }),
      // Elder mode reads verdicts aloud by default (§5.10).
      setElderMode: (on) => set(on ? { elderMode: true, voiceAuto: true } : { elderMode: false }),
      toggleElderMode: () =>
        set((s) => (s.elderMode ? { elderMode: false } : { elderMode: true, voiceAuto: true })),
      setAiOptIn: (aiOptIn) => set({ aiOptIn }),
      setVoiceAuto: (voiceAuto) => set({ voiceAuto }),
      setHaptics: (haptics) => set({ haptics }),
      setTrustedContact: (trustedContact) => set({ trustedContact }),
      setOnboarded: (onboarded) => set({ onboarded }),
      setTheme: (theme) => set({ theme }),
      setOnline: (online) => set({ online }),
      setDeviceTier: (deviceTier) => set({ deviceTier }),
      setLastResultId: (lastResultId) => set({ lastResultId }),
    }),
    {
      name: 'akshi-prefs',
      version: 1,
      storage: createJSONStorage(() => safeLocalStorage),
      partialize: (s): PersistedPrefs => ({
        lang: s.lang,
        elderMode: s.elderMode,
        aiOptIn: s.aiOptIn,
        voiceAuto: s.voiceAuto,
        haptics: s.haptics,
        trustedContact: s.trustedContact,
        onboarded: s.onboarded,
        theme: s.theme,
      }),
      // Drop anything malformed from storage instead of trusting it.
      merge: (persisted, current) => ({ ...current, ...sanitizePrefs(persisted) }),
    },
  ),
);

export function sanitizePrefs(raw: unknown): Partial<PersistedPrefs> {
  if (typeof raw !== 'object' || raw === null) return {};
  const r = raw as Record<string, unknown>;
  const out: Partial<PersistedPrefs> = {};
  if (isLang(r.lang)) out.lang = r.lang;
  for (const k of ['elderMode', 'aiOptIn', 'voiceAuto', 'haptics', 'onboarded'] as const) {
    if (typeof r[k] === 'boolean') out[k] = r[k];
  }
  if (isThemePref(r.theme)) out.theme = r.theme;
  const tc = r.trustedContact;
  if (tc === null) out.trustedContact = null;
  else if (
    typeof tc === 'object' &&
    typeof (tc as Record<string, unknown>).name === 'string' &&
    typeof (tc as Record<string, unknown>).phone === 'string'
  ) {
    const { name, phone } = tc as TrustedContact;
    out.trustedContact = { name, phone };
  }
  return out;
}

let demoApplied = false;

/**
 * URL flags that work on any route: `?simple=1` turns Elder mode on and keeps it
 * on (§5.10); `?lang=hi` switches the interface language; `?demo=1` (recording)
 * clears history once per page load, turns Elder mode off and puts the demo samples
 * first. It never changes a verdict or a score.
 */
export function applyUrlFlags(search: string): void {
  const params = new URLSearchParams(search);
  const { setElderMode, setLang } = useAppStore.getState();
  const demo = params.get('demo');
  if ((demo === '1' || demo === 'true') && !demoApplied) {
    demoApplied = true;
    useSession.setState({ demo: true });
    setElderMode(false);
    void import('./db').then((m) => m.clearHistory()).catch(() => undefined);
  }
  const simple = params.get('simple');
  if (simple === '1' || simple === 'true') setElderMode(true);
  const lang = params.get('lang');
  if (isLang(lang)) setLang(lang);
}
