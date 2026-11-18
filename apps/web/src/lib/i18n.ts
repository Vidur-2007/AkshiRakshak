/**
 * i18next setup (SPEC.md §8). English is bundled as the fallback for any missing
 * string. Hindi, Telugu and Bengali are separate chunks: the user's language loads
 * before first render, the rest prefetch when the browser is idle so switching
 * language keeps working offline for the session (the PWA precaches them in P4).
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '@/locales/en.json';
import type { Lang } from './engine';
import { useAppStore } from './store';

type Bundle = Record<string, unknown>;

const LOADERS: Record<Exclude<Lang, 'en'>, () => Promise<{ default: Bundle }>> = {
  hi: () => import('@/locales/hi.json'),
  te: () => import('@/locales/te.json'),
  bn: () => import('@/locales/bn.json'),
};

/** Short labels for the language switcher (§4). */
export const LANG_SHORT: Record<Lang, string> = { en: 'EN', hi: 'हि', te: 'తె', bn: 'বা' };

export function applyDocumentLang(lang: Lang): void {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = lang;
}

/** Makes sure a language's strings are loaded. Never throws: English covers a failure. */
export async function ensureLang(lang: Lang): Promise<void> {
  if (lang === 'en' || i18n.hasResourceBundle(lang, 'translation')) return;
  try {
    const mod = await LOADERS[lang]();
    i18n.addResourceBundle(lang, 'translation', mod.default, true, true);
  } catch {
    /* offline before this chunk was ever fetched: English fallback */
  }
}

export function loadAllLanguages(): Promise<void> {
  return Promise.all((Object.keys(LOADERS) as Lang[]).map(ensureLang)).then(() => undefined);
}

async function switchTo(lang: Lang): Promise<void> {
  await ensureLang(lang);
  await i18n.changeLanguage(lang);
  applyDocumentLang(lang);
}

let ready: Promise<typeof i18n> | null = null;

/** Initialises i18next and resolves once the stored language is ready to render. */
export function initI18n(): Promise<typeof i18n> {
  if (ready) return ready;
  const lang = useAppStore.getState().lang;
  void i18n.use(initReactI18next).init({
    resources: { en: { translation: en } },
    lng: lang,
    fallbackLng: 'en',
    supportedLngs: ['en', 'hi', 'te', 'bn'],
    interpolation: { escapeValue: false }, // React escapes already
    returnNull: false,
    initAsync: false,
  });
  applyDocumentLang(lang);
  useAppStore.subscribe((s, prev) => {
    if (s.lang !== prev.lang) void switchTo(s.lang);
  });
  ready = switchTo(lang).then(() => {
    const idle =
      typeof window !== 'undefined' && 'requestIdleCallback' in window
        ? (cb: () => void) => window.requestIdleCallback(cb, { timeout: 5000 })
        : (cb: () => void) => setTimeout(cb, 2000);
    idle(() => void loadAllLanguages());
    return i18n;
  });
  return ready;
}

export default i18n;
