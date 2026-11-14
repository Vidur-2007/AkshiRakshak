/**
 * scoreLive (SPEC.md §6.5): synchronous, rules only, < 5 ms per 1,000 characters.
 * Same rules layer and floors as analyze(), without links, indicators, model or AI.
 */
import { normalizeText, type Lang, type LiveScore } from '@akshi/contracts';
import { loadCalibration } from '@akshi/model';
import { matchRules, toSignals } from '../rules/engine';
import { highestFloor, rulesLayerScore, verdictOf } from './fusion';

const HAS_PHONE =
  /(?<!\d)(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}(?!\d)|(?<!\d)18[06]0[\s-]?\d{3}[\s-]?\d{4}(?!\d)/;

export function scoreLive(text: string, lang: Lang = 'en'): LiveScore {
  const t = normalizeText(text);
  let hits = matchRules(t);
  if (!HAS_PHONE.test(t)) hits = hits.filter((h) => h.id !== 'CUSTOMER_CARE_NUMBER');
  const signals = toSignals(hits, lang);
  const riskScore = Math.round(Math.max(rulesLayerScore(signals), highestFloor(signals)));
  return {
    riskScore,
    verdict: verdictOf(riskScore, loadCalibration()),
    topSignals: signals
      .filter((s) => s.weight > 0)
      .slice(0, 3)
      .map((s) => s.id),
  };
}
