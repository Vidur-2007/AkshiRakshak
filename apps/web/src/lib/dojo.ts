/**
 * Scam Dojo player logic (M11.1): walking a drill, scoring, and which red flags
 * the player caught or missed.
 */
import type { Drill, DrillChoice, DrillNode, SignalId } from './engine';

export interface DojoStep {
  nodeId: string;
  choiceId: string | null;
}

/** Best possible score from a node (depth-first, cycle-safe). */
export function maxScore(drill: Drill, from = drill.start, seen = new Set<string>()): number {
  const node = drill.nodes[from];
  if (!node || node.end || seen.has(from)) return 0;
  const next = new Set(seen).add(from);
  const options = (node.choices ?? []).map((c) => c.points + maxScore(drill, c.next, next));
  return options.length ? Math.max(...options) : 0;
}

export interface FlagTally {
  caught: SignalId[];
  missed: SignalId[];
}

/**
 * A choice that scores points and carries a red flag means the player spotted it;
 * a zero-point choice with a red flag means they fell for it.
 */
export function tallyFlags(choices: DrillChoice[]): FlagTally {
  const caught = new Set<SignalId>();
  const missed = new Set<SignalId>();
  for (const c of choices) {
    if (!c.redFlag) continue;
    if (c.points > 0) caught.add(c.redFlag);
    else missed.add(c.redFlag);
  }
  for (const f of caught) missed.delete(f);
  return { caught: [...caught], missed: [...missed] };
}

export function findChoice(node: DrillNode | undefined, choiceId: string): DrillChoice | undefined {
  return node?.choices?.find((c) => c.id === choiceId);
}

/** 0–1 share of the best possible score. */
export function scoreShare(score: number, max: number): number {
  return max > 0 ? Math.max(0, Math.min(1, score / max)) : 0;
}
