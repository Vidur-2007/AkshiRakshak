/**
 * i18next setup (SPEC.md §8). All four locales are bundled so the interface works
 * offline; any missing string falls back to English.
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import bn from '@/locales/bn.json';
import en from '@/locales/en.json';
import hi from '@/locales/hi.json';
import te from '@/locales/te.json';
import type { Lang } from './engine';
import { useAppStore } from './store';

export const resources = {
  en: { translation: en },
  hi: { translation: hi },
  te: { translation: te },
  bn: { translation: bn },
} as const;

/** Short labels for the language switcher (§4). */
export const LANG_SHORT: Record<Lang, string> = { en: 'EN', hi: 'हि', te: 'తె', bn: 'বা' };

export function applyDocumentLang(lang: Lang): void {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = lang;
}

export function initI18n(): typeof i18n {
  if (i18n.isInitialized) return i18n;
  const lang = useAppStore.getState().lang;
  void i18n.use(initReactI18next).init({
    resources,
    lng: lang,
    fallbackLng: 'en',
    supportedLngs: ['en', 'hi', 'te', 'bn'],
    interpolation: { escapeValue: false }, // React escapes already
    returnNull: false,
    initAsync: false,
  });
  applyDocumentLang(lang);
  useAppStore.subscribe((s, prev) => {
    if (s.lang === prev.lang) return;
    void i18n.changeLanguage(s.lang);
    applyDocumentLang(s.lang);
  });
  return i18n;
}

export default i18n;
