import type { L10n, Lang } from './engine';

/** A content string in the UI language, English when missing (SPEC.md §8). */
export function l10n(text: L10n, lang: Lang): string {
  return text[lang] ?? text.en;
}
