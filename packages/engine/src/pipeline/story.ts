/**
 * Attack story and manipulation tactics (new-features Phase 2). A scam is a sequence, not a list of
 * words: it hooks you (a trusted name or a lure), pressures you, gets onto your device, then takes
 * money or credentials. This module groups a result's signals into those stages and names the
 * psychological tactics behind them, in the user's language.
 *
 * Only evidence already found is used: each step names a signal that fired, so the story never
 * claims more than the checks saw. The explanation gets one sentence when three or more stages are
 * present; attackStory() and manipulationTactics() are exported for richer displays.
 */
import type { Lang, Signal, SignalId } from '@akshi/contracts';
import { storyLead, storyStep, tacticText, type Tactic } from '../i18n';

export type AttackStage = 'hook' | 'pressure' | 'compromise' | 'extraction';
export const ATTACK_STAGES: readonly AttackStage[] = [
  'hook',
  'pressure',
  'compromise',
  'extraction',
];

/** Signals of each stage, most specific first: the first one present names the step. */
const STAGE_SIGNALS: Readonly<Record<AttackStage, readonly SignalId[]>> = {
  hook: [
    'AUTHORITY_CLAIM',
    'BANK_IMPERSONATION',
    'CUSTOMER_CARE_NUMBER',
    'BRAND_MISMATCH',
    'WRONG_TRANSFER_RETURN',
    'TASK_JOB_PAYMENT',
    'TOO_GOOD_RETURNS',
    'PRIZE_LOTTERY',
  ],
  pressure: ['THREAT_LEGAL', 'THREAT_BLOCK', 'SECRECY', 'STAY_ON_CALL', 'URGENCY'],
  compromise: [
    'ASKS_REMOTE_APP',
    'APK_LINK',
    'LOOKALIKE_DOMAIN',
    'SUSPICIOUS_LINK',
    'PUNYCODE',
    'IP_URL',
    'SHORTENED_URL',
    'RISKY_TLD',
    'NEW_DOMAIN',
    'REDIRECT_CHAIN',
  ],
  extraction: [
    'RECEIVE_WITH_PIN',
    'QR_TO_RECEIVE',
    'ASKS_OTP',
    'ASKS_PIN',
    'ASKS_CVV_PASSWORD',
    'COLLECT_REQUEST',
    'ADVANCE_FEE',
    'PERSONAL_UPI_HANDLE',
  ],
};

/** Link signals without a phrase of their own read as "sends a risky link". */
const PHRASE_ALIAS: Partial<Record<SignalId, SignalId>> = {
  PUNYCODE: 'LOOKALIKE_DOMAIN',
  IP_URL: 'SUSPICIOUS_LINK',
  SHORTENED_URL: 'SUSPICIOUS_LINK',
  RISKY_TLD: 'SUSPICIOUS_LINK',
  NEW_DOMAIN: 'SUSPICIOUS_LINK',
  REDIRECT_CHAIN: 'SUSPICIOUS_LINK',
};

const TACTIC_SIGNALS: Readonly<Record<Tactic, readonly SignalId[]>> = {
  fear: ['THREAT_LEGAL', 'THREAT_BLOCK'],
  urgency: ['URGENCY', 'STAY_ON_CALL'],
  authority: ['AUTHORITY_CLAIM', 'BANK_IMPERSONATION', 'BRAND_MISMATCH', 'CUSTOMER_CARE_NUMBER'],
  secrecy: ['SECRECY', 'STAY_ON_CALL'],
  reward: ['PRIZE_LOTTERY', 'TASK_JOB_PAYMENT'],
  false_guarantee: ['TOO_GOOD_RETURNS'],
  payment_trick: ['RECEIVE_WITH_PIN', 'QR_TO_RECEIVE', 'COLLECT_REQUEST', 'WRONG_TRANSFER_RETURN'],
};

export interface AttackStep {
  stage: AttackStage;
  /** signals behind this step, the naming one first */
  signals: SignalId[];
  /** "asks for your OTP", in the requested language */
  text: string;
}

export interface TacticFound {
  tactic: Tactic;
  /** "Fear", "Authority pressure", … in the requested language */
  label: string;
  signals: SignalId[];
}

/** Only signals that point at a scam count (not SAFETY_ADVICE or other negative weights). */
function present(signals: readonly Pick<Signal, 'id' | 'weight'>[]): Set<SignalId> {
  return new Set(signals.filter((s) => s.weight > 0).map((s) => s.id));
}

/** The attack stages a result shows, in attack order, each named by its most specific signal. */
export function attackStory(
  signals: readonly Pick<Signal, 'id' | 'weight'>[],
  lang: Lang,
): AttackStep[] {
  const ids = present(signals);
  const steps: AttackStep[] = [];
  for (const stage of ATTACK_STAGES) {
    const here = STAGE_SIGNALS[stage].filter((id) => ids.has(id));
    const lead = here[0];
    if (!lead) continue;
    const text = storyStep(PHRASE_ALIAS[lead] ?? lead, lang);
    if (text) steps.push({ stage, signals: here, text });
  }
  return steps;
}

/** The manipulation tactics behind a result's signals, strongest evidence first. */
export function manipulationTactics(
  signals: readonly Pick<Signal, 'id' | 'weight'>[],
  lang: Lang,
): TacticFound[] {
  const ids = present(signals);
  return (Object.entries(TACTIC_SIGNALS) as [Tactic, readonly SignalId[]][])
    .map(([tactic, list]) => ({
      tactic,
      label: tacticText(tactic, lang),
      signals: list.filter((id) => ids.has(id)),
    }))
    .filter((t) => t.signals.length > 0)
    .sort((a, b) => b.signals.length - a.signals.length);
}

/** Stages needed before the explanation tells the story: fewer is a list, not a sequence. */
export const STORY_MIN_STAGES = 3;

/** "How this scam works: pretends to be your bank → rushes you → asks for your OTP." or null. */
export function storySentence(
  signals: readonly Pick<Signal, 'id' | 'weight'>[],
  lang: Lang,
): string | null {
  const steps = attackStory(signals, lang);
  if (steps.length < STORY_MIN_STAGES) return null;
  return storyLead(steps.map((s) => s.text).join(' → '), lang);
}
