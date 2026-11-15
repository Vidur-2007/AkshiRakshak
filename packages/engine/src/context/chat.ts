/**
 * Chat analysis (SPEC_A_ENGINE.md §9).
 *
 * Turns: WhatsApp exports (iOS "[dd/mm/yy, hh:mm(:ss) (AM)] Name: …" and Android
 * "dd/mm/yyyy, hh:mm (am) - Name: …"; continuation lines join the previous message), or
 * "Name: …" lines (≥ 3), else one turn per non-empty line. Every turn has offsets into the
 * normalised text (normalisation joins lines with one space).
 *
 * Senders: "You"/"Me"/आप/మీరు/আপনি… → me. Otherwise the first speaker is "them" (the person who
 * made contact) and the most frequent other speaker is "me"; anyone else is "them".
 *
 * ESCALATION (weight 0.2) fires when
 *  (a) risk rises across at least three "them" turns and ends ≥ 60, or
 *  (b) "them" turns move through problem → link/app → OTP/PIN/payment (a greeting may come first).
 */
import { normalizeText, type ChatTurnRisk, type SignalId, type Span } from '@akshi/contracts';
import { NAME_LINE, WA_ANDROID_LINE, WA_IOS_LINE } from '../detect/kind';
import { matchRules } from '../rules/engine';

export interface ChatTurn {
  index: number;
  name?: string;
  sender: ChatTurnRisk['sender'];
  /** full turn text in the normalised chat text (header included) */
  text: string;
  /** message body without the timestamp / name header */
  body: string;
  start: number;
  end: number;
}

type Mode = 'whatsapp' | 'names' | 'lines';

const ME_NAMES = /^(?:you|me|myself|self|आप|मैं|मैंने|మీరు|నేను|আপনি|আমি)$/iu;
/** WhatsApp system lines ("Messages and calls are end-to-end encrypted", "<attached>") */
const SYSTEM_BODY =
  /end-to-end encrypted|security code changed|<media omitted>|this message was deleted|missed (?:voice|video) call/i;

function header(line: string, mode: Mode): { name: string; body: string } | null {
  if (mode === 'whatsapp') {
    const m = WA_IOS_LINE.exec(line) ?? WA_ANDROID_LINE.exec(line);
    return m ? { name: (m[1] ?? '').trim(), body: line.slice(m[0].length).trim() } : null;
  }
  if (mode === 'names') {
    const m = NAME_LINE.exec(line);
    if (!m || /^(?:from|to|subject|reply-to|cc|date|note|https?)$/i.test(m[1] ?? '')) return null;
    return { name: (m[1] ?? '').trim(), body: line.slice(m[0].length).trim() };
  }
  return null;
}

export function chatMode(lines: string[]): Mode {
  const wa = lines.filter((l) => WA_IOS_LINE.test(l) || WA_ANDROID_LINE.test(l)).length;
  if (wa >= 2) return 'whatsapp';
  const named = lines.filter((l) => header(l, 'names')).length;
  return named >= 3 ? 'names' : 'lines';
}

/** Split a chat into turns with offsets into `text` (the normalised raw chat). */
/** Left-to-right / right-to-left marks that WhatsApp iOS exports put before lines. */
const BIDI_MARKS = new RegExp(
  `^[${String.fromCodePoint(0x200e)}${String.fromCodePoint(0x200f)}${String.fromCodePoint(0x202a)}-${String.fromCodePoint(0x202e)}]+`,
  'u',
);

export function parseChat(raw: string, text: string): ChatTurn[] {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => normalizeText(l).replace(BIDI_MARKS, ''))
    .filter(Boolean);
  const mode = chatMode(lines);
  const turns: ChatTurn[] = [];
  let from = 0;
  for (const line of lines) {
    const start = text.indexOf(line, from);
    if (start < 0) continue;
    from = start + line.length;
    const h = header(line, mode);
    const last = turns.at(-1);
    if (!h && mode !== 'lines' && last) {
      // continuation of a multi-line message
      last.end = start + line.length;
      last.text = text.slice(last.start, last.end);
      last.body = `${last.body} ${line}`.trim();
      continue;
    }
    const turn: ChatTurn = {
      index: turns.length,
      sender: 'unknown',
      text: line,
      body: h ? h.body : line,
      start,
      end: start + line.length,
    };
    if (h?.name) turn.name = h.name;
    turns.push(turn);
  }
  assignSenders(turns);
  return turns;
}

export function assignSenders(turns: ChatTurn[]): void {
  const named = turns.filter((t) => t.name && !SYSTEM_BODY.test(t.body));
  const counts = new Map<string, number>();
  for (const t of named) counts.set(t.name!, (counts.get(t.name!) ?? 0) + 1);
  const explicitMe = [...counts.keys()].find((n) => ME_NAMES.test(n));
  const first = named.find((t) => !ME_NAMES.test(t.name!))?.name;
  let me = explicitMe;
  if (!me) {
    let best = 0;
    for (const [n, c] of counts) {
      if (n !== first && c > best) {
        me = n;
        best = c;
      }
    }
  }
  for (const t of turns) {
    if (!t.name || SYSTEM_BODY.test(t.body)) t.sender = 'unknown';
    else t.sender = t.name === me || ME_NAMES.test(t.name) ? 'me' : 'them';
  }
}

// ───────────── escalation ─────────────

const GREETING =
  /^(?:hi|hii+|hello|hey|dear|good (?:morning|afternoon|evening)|namaste|namaskar|नमस्ते|नमस्कार|హలో|నమస్కారం|నమస్తే|হ্যালো|নমস্কার)\b/iu;
const PROBLEM: ReadonlySet<SignalId> = new Set([
  'THREAT_BLOCK',
  'THREAT_LEGAL',
  'AUTHORITY_CLAIM',
  'BANK_IMPERSONATION',
  'PRIZE_LOTTERY',
  'WRONG_TRANSFER_RETURN',
  'TASK_JOB_PAYMENT',
  'TOO_GOOD_RETURNS',
  'CUSTOMER_CARE_NUMBER',
  'SECRECY',
]);
const LINK_APP: ReadonlySet<SignalId> = new Set([
  'APK_LINK',
  'ASKS_REMOTE_APP',
  'COLLECT_REQUEST',
  'QR_TO_RECEIVE',
]);
const ASK: ReadonlySet<SignalId> = new Set([
  'ASKS_OTP',
  'ASKS_PIN',
  'ASKS_CVV_PASSWORD',
  'RECEIVE_WITH_PIN',
  'ADVANCE_FEE',
]);
const LINK_RE =
  /\b(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(?:com|in|net|org|xyz|top|site|online|info|link|me|io|app)\b(?:\/\S*)?/i;

export interface Escalation {
  /** indexes of the turns that show the escalation, in order */
  turns: number[];
  rule: 'rising_risk' | 'sequence';
}

/** (a) a strictly rising run of ≥ 3 "them" risks ending ≥ 60 (not necessarily consecutive turns) */
function risingRisk(them: { index: number; risk: number }[]): number[] | null {
  const n = them.length;
  const best: { len: number; prev: number }[] = them.map(() => ({ len: 1, prev: -1 }));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < i; j++) {
      if (them[j]!.risk < them[i]!.risk && best[j]!.len + 1 > best[i]!.len)
        best[i] = { len: best[j]!.len + 1, prev: j };
    }
  }
  let end = -1;
  for (let i = 0; i < n; i++)
    if (best[i]!.len >= 3 && them[i]!.risk >= 60 && (end < 0 || best[i]!.len > best[end]!.len))
      end = i;
  if (end < 0) return null;
  const chain: number[] = [];
  for (let k = end; k >= 0; k = best[k]!.prev) chain.unshift(them[k]!.index);
  return chain;
}

/** (b) problem → link/app → ask across "them" turns (problem and link may share a turn). */
function stageSequence(
  them: { index: number; body: string; ids: Set<SignalId> }[],
): number[] | null {
  const has = (t: (typeof them)[number], set: ReadonlySet<SignalId>) =>
    [...t.ids].some((id) => set.has(id));
  for (let a = 0; a < them.length; a++) {
    if (!has(them[a]!, PROBLEM)) continue;
    for (let b = a; b < them.length; b++) {
      const tb = them[b]!;
      if (!(has(tb, LINK_APP) || LINK_RE.test(tb.body))) continue;
      for (let c = b + 1; c < them.length; c++) {
        if (!has(them[c]!, ASK)) continue;
        const chain = [...new Set([them[a]!.index, tb.index, them[c]!.index])];
        const greet = them.slice(0, a).find((t) => GREETING.test(t.body));
        return greet ? [greet.index, ...chain] : chain;
      }
    }
  }
  return null;
}

export interface ChatAnalysis {
  turns: ChatTurn[];
  risks: ChatTurnRisk[];
  escalation: Escalation | null;
  /** spans of the turns behind the escalation (for the ESCALATION signal) */
  escalationSpans: Span[];
}

export function analyzeChat(
  raw: string,
  text: string,
  turnRisk: (turnText: string) => number,
): ChatAnalysis {
  const turns = parseChat(raw, text);
  const risks: ChatTurnRisk[] = turns.map((t) => ({
    index: t.index,
    sender: t.sender,
    text: t.text,
    risk: turnRisk(t.text),
    start: t.start,
    end: t.end,
  }));
  const them = turns
    .map((t, i) => ({
      index: t.index,
      body: t.body,
      risk: risks[i]!.risk,
      sender: t.sender,
      ids: new Set(matchRules(normalizeText(t.body)).map((h) => h.id)),
    }))
    .filter((t) => t.sender === 'them');
  const rising = risingRisk(them);
  const sequence = rising ? null : stageSequence(them);
  const escalation: Escalation | null = rising
    ? { turns: rising, rule: 'rising_risk' }
    : sequence
      ? { turns: sequence, rule: 'sequence' }
      : null;
  const escalationSpans = (escalation?.turns ?? []).map((i) => {
    const t = turns[i]!;
    return { start: t.start, end: t.end, text: t.text };
  });
  return { turns, risks, escalation, escalationSpans };
}

/** Back-compat helper used by older call sites: per-turn risks only. */
export function chatTurns(
  raw: string,
  text: string,
  risk: (turn: string) => number,
): ChatTurnRisk[] {
  return analyzeChat(raw, text, risk).risks;
}
