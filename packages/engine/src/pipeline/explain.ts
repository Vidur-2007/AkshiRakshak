/**
 * Explanation (SPEC_A_ENGINE.md §8.7): category one-liner + the top two reasons, at most two
 * sentences, second person. Never says "safe". The AI explanation replaces it when AI is used (P3).
 * analyze() may append one attack-story sentence after it (pipeline/story.ts).
 */
import type { Lang, ScamCategory, Signal, Verdict } from '@akshi/contracts';
import { categoryText, template } from '../i18n';

export function explain(
  verdict: Verdict,
  category: ScamCategory | null,
  signals: readonly Signal[],
  lang: Lang,
): string {
  if (verdict === 'no_signs') return template('noSigns', lang);
  const lead = category ? categoryText(category, lang).oneLiner : template('genericLead', lang);
  const top = signals.filter((s) => s.weight > 0 && s.id !== 'MODEL_PATTERN').slice(0, 2);
  if (!top.length) return lead;
  const reasons = top.map((s) => s.label).join(template('listSep', lang));
  return `${lead} ${template('reasons', lang, { reasons })}`;
}
