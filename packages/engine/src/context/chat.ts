/**
 * Chat parsing (SPEC_A_ENGINE.md §9). P1: split into turns (WhatsApp iOS/Android exports or
 * "Name:" lines, else one turn per line) with offsets into the normalised text and a live
 * risk per turn. P4: sender heuristics refinement and ESCALATION.
 */
import { normalizeText, type ChatTurnRisk } from '@akshi/contracts';
import { NAME_LINE, WA_ANDROID_LINE, WA_IOS_LINE } from '../detect/kind';

export function chatTurns(
  raw: string,
  text: string,
  risk: (turn: string) => number,
): ChatTurnRisk[] {
  const turns: ChatTurnRisk[] = [];
  const names: string[] = [];
  let from = 0;
  for (const line of raw.split(/\r?\n/)) {
    const t = normalizeText(line);
    if (!t) continue;
    const start = text.indexOf(t, from);
    if (start < 0) continue;
    from = start + t.length;
    const name = (WA_IOS_LINE.exec(t) ?? WA_ANDROID_LINE.exec(t) ?? NAME_LINE.exec(t))?.[1]?.trim();
    if (name && !names.includes(name)) names.push(name);
    const sender: ChatTurnRisk['sender'] = !name
      ? 'unknown'
      : /^(?:you|me|आप|मैं|మీరు|నేను|আপনি|আমি)$/i.test(name) || name === names[1]
        ? 'me'
        : 'them';
    turns.push({
      index: turns.length,
      sender,
      text: t,
      risk: risk(t),
      start,
      end: start + t.length,
    });
  }
  return turns;
}
