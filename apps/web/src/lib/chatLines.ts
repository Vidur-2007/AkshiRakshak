/**
 * Display helpers for chat turns (ChatThreadView, §5.5): strips WhatsApp-style
 * "[date, time] Name:" prefixes and finds where the risk escalates.
 */
import type { ChatTurnRisk } from './engine';

export interface ChatBubble {
  index: number;
  sender: ChatTurnRisk['sender'];
  name: string | null;
  time: string | null;
  body: string;
  risk: number;
}

const BRACKET = /^\[([^\]]+)\]\s*([^:]{1,40}):\s*/;
const DASH = /^(\d{1,2}\/\d{1,2}\/\d{2,4},?\s*\d{1,2}:\d{2}(?:\s?[ap]m)?)\s*-\s*([^:]{1,40}):\s*/i;
const NAME = /^([^:\n]{1,30}):\s+/;

export function toBubble(turn: ChatTurnRisk): ChatBubble {
  const base = { index: turn.index, sender: turn.sender, risk: turn.risk };
  const b = BRACKET.exec(turn.text) ?? DASH.exec(turn.text);
  if (b) {
    const time = (b[1] ?? '').split(/,\s*/).pop() ?? null;
    return { ...base, time, name: b[2]?.trim() ?? null, body: turn.text.slice(b[0].length) };
  }
  const n = NAME.exec(turn.text);
  if (n && !/^https?$/i.test(n[1] ?? ''))
    return { ...base, time: null, name: n[1]?.trim() ?? null, body: turn.text.slice(n[0].length) };
  return { ...base, time: null, name: null, body: turn.text };
}

/**
 * Index of the first message where risk crosses the suspicious line (40), or the
 * biggest single jump of at least 20 points; null if neither happens.
 */
export function escalationIndex(risks: number[], threshold = 40): number | null {
  const cross = risks.findIndex(
    (r, i) => r >= threshold && (i === 0 || (risks[i - 1] ?? 0) < threshold),
  );
  if (cross >= 0) return cross;
  let best: number | null = null;
  let jump = 19;
  for (let i = 1; i < risks.length; i++) {
    const d = (risks[i] ?? 0) - (risks[i - 1] ?? 0);
    if (d > jump) {
      jump = d;
      best = i;
    }
  }
  return best;
}
