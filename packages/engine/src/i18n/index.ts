/**
 * Engine strings (SPEC_A_ENGINE.md §13). English is complete; other languages fall back
 * to English per string. Non-English files carry "_review": "pending" until a reader checks them.
 */
import type { ActionId, Lang, ScamCategory, SignalId, StageTiming } from '@akshi/contracts';
import bn from './bn.json';
import en from './en.json';
import hi from './hi.json';
import te from './te.json';

export interface Strings {
  _review?: string;
  signals: Partial<Record<SignalId, { label: string; detail: string }>>;
  categories: Partial<Record<ScamCategory, { name: string; oneLiner: string }>>;
  actions: Partial<Record<ActionId, { label: string; body: string }>>;
  stages: Partial<Record<StageTiming['stage'], string>>;
  templates: Partial<Record<TemplateKey, string>>;
}
export const TEMPLATE_KEYS = [
  'noSigns',
  'reasons',
  'listSep',
  'genericLead',
  'pinTruth',
  'qrPayee',
  'qrPayeeNoName',
  'qrWebsite',
  'claimBrand',
  'realityLink',
  'realityLinkUnknown',
  'realityLinkAge',
  'realityUpiPersonal',
  'realityPhonePersonal',
  'claimLookalike',
  'realityLookalike',
  'claimReceive',
  'claimReceiveMoney',
  'realityPinSends',
  'realityPinSendsMoney',
  'claimPayeeName',
  'realityPayeeUpi',
  'claimQrNote',
  'realityQrPays',
  'realityQrPaysMoney',
  'claimQrPayment',
  'realityQrWebsite',
  'claimRequester',
  'realityRequesterPersonal',
  'evidenceLink',
  'evidenceUpi',
  'evidencePhone',
] as const;
export type TemplateKey = (typeof TEMPLATE_KEYS)[number];

export const STRINGS: Readonly<Record<Lang, Strings>> = { en, hi, te, bn };
const EN = en as Strings;

const ACTION_HREF: Partial<Record<ActionId, string>> = {
  report_chakshu: 'https://sancharsaathi.gov.in/sfc/',
  report_1930: 'tel:1930',
  report_cybercrime_portal: 'https://cybercrime.gov.in',
};

export function signalText(id: SignalId, lang: Lang): { label: string; detail: string } {
  const s = STRINGS[lang].signals[id] ?? EN.signals[id];
  return { label: s?.label ?? id, detail: s?.detail ?? '' };
}

export function categoryText(c: ScamCategory, lang: Lang): { name: string; oneLiner: string } {
  const s = STRINGS[lang].categories[c] ?? EN.categories[c];
  return { name: s?.name ?? c, oneLiner: s?.oneLiner ?? '' };
}

export function actionText(
  a: ActionId,
  lang: Lang,
): { label: string; body: string; href?: string } {
  const s = STRINGS[lang].actions[a] ?? EN.actions[a];
  const out: { label: string; body: string; href?: string } = {
    label: s?.label ?? a,
    body: s?.body ?? '',
  };
  const href = ACTION_HREF[a];
  if (href) out.href = href;
  return out;
}

export function stageText(stage: StageTiming['stage'], lang: Lang): string {
  return STRINGS[lang].stages[stage] ?? EN.stages[stage] ?? stage;
}

export function template(key: TemplateKey, lang: Lang, vars: Record<string, string> = {}): string {
  const t = STRINGS[lang].templates[key] ?? EN.templates[key] ?? '';
  return t.replace(/\{(\w+)\}/g, (_m, k: string) => vars[k] ?? '');
}
