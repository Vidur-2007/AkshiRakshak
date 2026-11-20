/**
 * Day and night themes (design 2026-11-20). The preference is 'system' (follow the phone),
 * 'day' or 'night'; the resolved theme goes on <html data-theme> and into the browser's
 * theme-color. index.html runs the same resolution before the first paint, so there is no flash.
 */
export type ThemePref = 'system' | 'day' | 'night';
export type Theme = 'day' | 'night';

export const THEME_PREFS: readonly ThemePref[] = ['system', 'day', 'night'];
export const THEME_COLOR: Readonly<Record<Theme, string>> = { night: '#05070b', day: '#eef0f2' };

export function isThemePref(v: unknown): v is ThemePref {
  return typeof v === 'string' && (THEME_PREFS as readonly string[]).includes(v);
}

export function systemTheme(): Theme {
  try {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'day' : 'night';
  } catch {
    return 'night';
  }
}

export function resolveTheme(pref: ThemePref, system: Theme = systemTheme()): Theme {
  return pref === 'system' ? system : pref;
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.classList.toggle('dark', theme === 'night');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme]);
  document
    .querySelector('meta[name="color-scheme"]')
    ?.setAttribute('content', theme === 'night' ? 'dark' : 'light');
}

/** The theme the page shows right now (for canvas drawing that cannot read CSS variables). */
export function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'day' ? 'day' : 'night';
}
