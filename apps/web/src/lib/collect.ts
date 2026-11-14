/**
 * Collect-request guard helpers (§5.4): the form state, its mapping to
 * CollectRequestInput, and pre-filling from a screenshot's entities.
 */
import type { AnalysisResult, CollectRequestInput, Entities } from './engine';

export interface CollectForm {
  requesterName: string;
  requesterUpi: string;
  amount: string;
  note: string;
  toldYouWillReceive: boolean | null;
  contactedFirst: CollectRequestInput['contactedFirst'] | null;
  underPressure: boolean | null;
  knowRequester: CollectRequestInput['knowRequester'] | null;
}

export const EMPTY_COLLECT: CollectForm = {
  requesterName: '',
  requesterUpi: '',
  amount: '',
  note: '',
  toldYouWillReceive: null,
  contactedFirst: null,
  underPressure: null,
  knowRequester: null,
};

/** "4,999", "₹ 4999.50", "Rs 500" → number, or undefined. */
export function parseAmount(raw: string): number | undefined {
  const cleaned = raw.replace(/[₹,\s]|rs\.?|inr/gi, '');
  if (!cleaned) return undefined;
  const n = Number(cleaned);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : undefined;
}

/** Unanswered questions take the cautious default (unknown / not sure). */
export function toCollectInput(f: CollectForm): CollectRequestInput {
  const input: CollectRequestInput = {
    toldYouWillReceive: f.toldYouWillReceive === true,
    contactedFirst: f.contactedFirst ?? 'unknown',
    underPressure: f.underPressure === true,
    knowRequester: f.knowRequester ?? 'unsure',
  };
  const name = f.requesterName.trim();
  const upi = f.requesterUpi.trim();
  const note = f.note.trim();
  const amount = parseAmount(f.amount);
  if (name) input.requesterName = name;
  if (upi) input.requesterUpi = upi;
  if (note) input.note = note;
  if (amount !== undefined) input.amount = amount;
  return input;
}

/** Fields we can fill from the text read off a collect-request screenshot. */
export function prefillFromEntities(e: Entities, text: string): Partial<CollectForm> {
  const out: Partial<CollectForm> = {};
  const upi = e.upiIds[0]?.raw;
  if (upi) out.requesterUpi = upi;
  const amount = e.amounts[0]?.value;
  if (amount !== undefined) out.amount = String(amount);
  const note = /(?:note|remarks?|message)\s*[:-]\s*(.+)/i.exec(text)?.[1]?.trim();
  if (note) out.note = note.slice(0, 80);
  return out;
}

/**
 * The PIN-pad explainer plays when the engine flags "enter PIN to receive" — and,
 * since that is exactly the trap, whenever the user said they were told they would
 * receive money.
 */
export function shouldExplainPin(result: AnalysisResult, toldYouWillReceive: boolean): boolean {
  return toldYouWillReceive || result.signals.some((s) => s.id === 'RECEIVE_WITH_PIN');
}
