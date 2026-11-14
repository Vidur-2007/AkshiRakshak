/**
 * Collect requests (SPEC_A_ENGINE.md §6.5).
 * P1: compose the analysed text from the guided form so the rules engine sees the note and name.
 * P2: RECEIVE_WITH_PIN floor 90, COLLECT_REQUEST +0.15, URGENCY from underPressure,
 *     requester UPI checks and claims-vs-reality.
 */
import type { CollectRequestInput } from '@akshi/contracts';

export function collectToText(c: CollectRequestInput): string {
  const who = [c.requesterName, c.requesterUpi ? `(${c.requesterUpi})` : '']
    .filter(Boolean)
    .join(' ');
  const amount = c.amount !== undefined ? ` for ₹${c.amount.toLocaleString('en-IN')}` : '';
  const parts = [
    `Collect request${who ? ` from ${who}` : ''}${amount}.`,
    c.note ? `Note: ${c.note}` : '',
  ];
  return parts.filter(Boolean).join(' ');
}
