/**
 * Collect requests (SPEC_A_ENGINE.md §6.5), from the guided form:
 *  - toldYouWillReceive → RECEIVE_WITH_PIN, floor 90, and the plain statement that entering the
 *    UPI PIN always sends money;
 *  - contactedFirst 'them' and requester not known → COLLECT_REQUEST with +0.15;
 *  - underPressure → URGENCY;
 *  - requesterUpi → UPI checks; a requester name that claims a bank, refund desk or government
 *    body with a personal handle → UPI_NAME_MISMATCH (claims/brands.ts, via payeeName);
 *  - note → the rules engine (it is part of the analysed text);
 *  - actions: decline_request, do_not_pay, block_sender, report_chakshu (+ report_1930 when the
 *    note says money is already gone).
 */
import type { ActionId, ClaimCheck, CollectRequestInput, Lang, Signal } from '@akshi/contracts';
import { amountText } from '../claims/brands';
import { signalText, template } from '../i18n';
import { CATALOG } from '../rules/catalog';

export function collectToText(c: CollectRequestInput): string {
  const who = [c.requesterName, c.requesterUpi ? `(${c.requesterUpi})` : '']
    .filter(Boolean)
    .join(' ');
  const amount = c.amount !== undefined ? ` for ${amountText(c.amount)}` : '';
  return [`Collect request${who ? ` from ${who}` : ''}${amount}.`, c.note ? `Note: ${c.note}` : '']
    .filter(Boolean)
    .join(' ');
}

export interface CollectAnalysis {
  signals: Signal[];
  claims: ClaimCheck[];
  floor: number;
  actions: ActionId[];
  /** explanation lead: the PIN truth, when the user was told they would receive money */
  lead?: string;
}

export const COLLECT_ACTIONS: readonly ActionId[] = [
  'decline_request',
  'do_not_pay',
  'block_sender',
  'report_chakshu',
];

export function analyzeCollect(
  c: CollectRequestInput,
  text: string,
  lang: Lang,
  moneyLost: boolean,
): CollectAnalysis {
  const signals: Signal[] = [];
  const claims: ClaimCheck[] = [];
  const sig = (id: Signal['id'], weight = CATALOG[id].weight): Signal => {
    const at = id === 'COLLECT_REQUEST' ? text.indexOf('Collect request') : -1;
    const spans =
      at >= 0 ? [{ start: at, end: at + 'Collect request'.length, text: 'Collect request' }] : [];
    return { id, weight, source: 'upi', ...signalText(id, lang), spans };
  };
  let floor = 0;
  let lead: string | undefined;
  if (c.toldYouWillReceive) {
    signals.push(sig('RECEIVE_WITH_PIN'));
    floor = 90;
    lead = template('pinTruth', lang);
    const amount = c.amount !== undefined ? amountText(c.amount) : undefined;
    claims.push({
      claim: amount
        ? template('claimReceive', lang, { amount })
        : template('claimReceiveMoney', lang),
      reality:
        amount && c.requesterUpi
          ? template('realityPinSends', lang, { amount, upi: c.requesterUpi })
          : template('realityPinSendsMoney', lang),
      mismatch: true,
      signal: 'RECEIVE_WITH_PIN',
    });
  }
  if (c.contactedFirst === 'them' && c.knowRequester !== 'yes')
    signals.push(sig('COLLECT_REQUEST', CATALOG.COLLECT_REQUEST.weight + 0.15));
  if (c.underPressure) signals.push({ ...sig('URGENCY'), source: 'context' });
  const actions: ActionId[] = moneyLost
    ? ['emergency', 'report_1930', ...COLLECT_ACTIONS]
    : [...COLLECT_ACTIONS];
  const out: CollectAnalysis = {
    signals,
    claims,
    floor,
    actions: [...new Set(actions)].slice(0, 5),
  };
  if (lead) out.lead = lead;
  return out;
}
