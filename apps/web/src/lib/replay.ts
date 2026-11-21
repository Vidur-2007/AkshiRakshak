/**
 * Scam Replay: the attack a message sets up, as a step-by-step timeline.
 *
 * Built only from evidence the checks found. Each step is an attack stage the engine names from a
 * signal that fired (pipeline/story.ts), quotes the words of the message behind it, and lists the
 * manipulation tactics it uses. Nothing here guesses beyond the signals: no step without a signal,
 * no quote that is not in the message.
 */
import {
  attackStory,
  manipulationTactics,
  type AttackStage,
  type Lang,
  type Signal,
  type Verdict,
} from './engine';

export interface ReplayStep {
  stage: AttackStage;
  /** "pretends to be your bank", in the requested language */
  text: string;
  /** words from the message behind this step, when the signal points at them */
  quote: string | null;
  /** tactic names first shown at this step ("Fear", "Authority pressure") */
  tactics: string[];
}

export interface Replay {
  steps: ReplayStep[];
  /**
   * Index of the step Akshi's warning comes before: the first step that asks you to act (open a
   * link or app, share a code, pay). Equal to steps.length when the message only hooks and
   * pressures; then the warning closes the replay.
   */
  stopAt: number;
  /** what the scam is after, from its last stage; null when it does not ask for anything yet */
  goal: 'money' | 'control' | null;
}

/** Steps needed for a replay: one step is a reason, not a sequence. */
export const REPLAY_MIN_STEPS = 2;
const ACT_STAGES: readonly AttackStage[] = ['compromise', 'extraction'];
const QUOTE_MAX = 70;

function quoteFor(signalIds: readonly string[], signals: readonly Signal[], text: string) {
  for (const id of signalIds) {
    const span = signals.find((s) => s.id === id)?.spans[0];
    if (!span) continue;
    const words = (text.slice(span.start, span.end) || span.text).replace(/\s+/g, ' ').trim();
    if (!words) continue;
    return words.length > QUOTE_MAX ? `${words.slice(0, QUOTE_MAX - 1).trimEnd()}…` : words;
  }
  return null;
}

/** The replay for a result, or null when there is no attack sequence to show. */
export function buildReplay(
  result: { verdict: Verdict; signals: Signal[]; text: string },
  lang: Lang,
): Replay | null {
  if (result.verdict === 'no_signs') return null;
  const story = attackStory(result.signals, lang);
  if (story.length < REPLAY_MIN_STEPS) return null;
  const tactics = manipulationTactics(result.signals, lang);
  const shown = new Set<string>();
  const steps: ReplayStep[] = story.map((s) => {
    const here = tactics
      .filter((t) => !shown.has(t.tactic) && t.signals.some((id) => s.signals.includes(id)))
      .map((t) => {
        shown.add(t.tactic);
        return t.label;
      });
    return {
      stage: s.stage,
      text: s.text,
      quote: quoteFor(s.signals, result.signals, result.text),
      tactics: here,
    };
  });
  const act = steps.findIndex((s) => ACT_STAGES.includes(s.stage));
  const last = steps[steps.length - 1]!.stage;
  return {
    steps,
    stopAt: act === -1 ? steps.length : act,
    goal: last === 'extraction' ? 'money' : last === 'compromise' ? 'control' : null,
  };
}

/** "pretends to be your bank" → "Pretends to be your bank" (Latin scripts only change). */
export function sentenceCase(s: string): string {
  return s.charAt(0).toLocaleUpperCase() + s.slice(1);
}
