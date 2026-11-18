/**
 * Engine strings (SPEC_A_ENGINE.md §13). English is complete; other languages fall back
 * to English per string. Non-English files carry "_review": "pending" until a reader checks them.
 */
import type { ActionId, Lang, ScamCategory, SignalId, StageTiming } from '@akshi/contracts';
import en from './en.json';

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
  'claimSender',
  'realitySender',
  'realitySenderUnknown',
  'realityReplyTo',
  'evidenceSender',
  'whatUpi',
  'whatPhone',
  'whatUrl',
  'lookupReported',
  'lookupBlocked',
  'lookupClean',
  'faqNotCovered',
] as const;
export type TemplateKey = (typeof TEMPLATE_KEYS)[number];

const EN = en as Strings;

/**
 * English is in the core bundle; Hindi, Telugu and Bengali load lazily (SPEC_A_ENGINE.md §14).
 * Until a language has loaded, its strings fall back to English, exactly like a missing key.
 * analyze() awaits the request language; warmup(lang) preloads it.
 */
const LAZY: Readonly<Record<Exclude<Lang, 'en'>, () => Promise<{ default: unknown }>>> = {
  hi: () => import('./hi.json'),
  te: () => import('./te.json'),
  bn: () => import('./bn.json'),
};
const loaded: Partial<Record<Lang, Strings>> = { en: EN };
const loading = new Map<Lang, Promise<void>>();

export function stringsReady(lang: Lang): boolean {
  return loaded[lang] !== undefined;
}

/** Loads one language's strings (memoised). Never rejects; English stays the fallback. */
export function ensureStrings(lang: Lang): Promise<void> {
  if (loaded[lang]) return Promise.resolve();
  let p = loading.get(lang);
  if (!p) {
    p = LAZY[lang as Exclude<Lang, 'en'>]()
      .then((m) => {
        loaded[lang] = m.default as Strings;
      })
      .catch(() => {
        loading.delete(lang);
      });
    loading.set(lang, p);
  }
  return p;
}

/** Strings for a language, loading it in the background if needed (English until then). */
function S(lang: Lang): Strings {
  const s = loaded[lang];
  if (!s) void ensureStrings(lang);
  return s ?? EN;
}

/** Every language's strings (loads all). Tests and tools. */
export async function loadAllStrings(): Promise<Readonly<Record<Lang, Strings>>> {
  await Promise.all((['hi', 'te', 'bn'] as const).map(ensureStrings));
  return { en: EN, hi: S('hi'), te: S('te'), bn: S('bn') };
}

const ACTION_HREF: Partial<Record<ActionId, string>> = {
  report_chakshu: 'https://sancharsaathi.gov.in/sfc/',
  report_1930: 'tel:1930',
  report_cybercrime_portal: 'https://cybercrime.gov.in',
};

export function signalText(id: SignalId, lang: Lang): { label: string; detail: string } {
  const s = S(lang).signals[id] ?? EN.signals[id];
  return { label: s?.label ?? id, detail: s?.detail ?? '' };
}

export function categoryText(c: ScamCategory, lang: Lang): { name: string; oneLiner: string } {
  const s = S(lang).categories[c] ?? EN.categories[c];
  return { name: s?.name ?? c, oneLiner: s?.oneLiner ?? '' };
}

export function actionText(
  a: ActionId,
  lang: Lang,
): { label: string; body: string; href?: string } {
  const s = S(lang).actions[a] ?? EN.actions[a];
  const out: { label: string; body: string; href?: string } = {
    label: s?.label ?? a,
    body: s?.body ?? '',
  };
  const href = ACTION_HREF[a];
  if (href) out.href = href;
  return out;
}

export function stageText(stage: StageTiming['stage'], lang: Lang): string {
  return S(lang).stages[stage] ?? EN.stages[stage] ?? stage;
}

export function template(key: TemplateKey, lang: Lang, vars: Record<string, string> = {}): string {
  const t = S(lang).templates[key] ?? EN.templates[key] ?? '';
  return t.replace(/\{(\w+)\}/g, (_m, k: string) => vars[k] ?? '');
}
