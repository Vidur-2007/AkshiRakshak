/**
 * Claim-vs-reality rows that come from the message as a whole (new-features Phase 2), shown in
 * the existing "What they claim vs reality" card:
 *
 * - Payment direction: the message promises money in ("enter your PIN to receive ₹4,999"), but a
 *   PIN or a QR payment sends money out. The collect form adds its own row (upi/collect.ts), so this
 *   one is for messages, chats, emails and screenshots.
 * - Authority: "police", "court", "CBI" claims checked against what the message actually does. A
 *   personal UPI ID or a "stay on the call and keep it secret" demand contradicts the claim
 *   (mismatch). A personal mobile number only "could not be verified" (no mismatch): an unfamiliar
 *   number is not proof that the claim is false.
 */
import type { ClaimCheck, Entities, Lang, Signal, SignalId } from '@akshi/contracts';
import { template } from '../i18n';
import { amountText } from './brands';

export interface MessageClaimInput {
  signals: readonly Pick<Signal, 'id' | 'weight'>[];
  entities: Pick<Entities, 'amounts' | 'upiIds' | 'phones'>;
  lang: Lang;
  /** the collect form already added the receive-vs-PIN row */
  collectRow: boolean;
}

export function messageClaims({
  signals,
  entities,
  lang,
  collectRow,
}: MessageClaimInput): ClaimCheck[] {
  const has = (id: SignalId) => signals.some((s) => s.id === id && s.weight > 0);
  const claims: ClaimCheck[] = [];
  const amount = entities.amounts[0] ? amountText(entities.amounts[0].value) : undefined;
  const upi = entities.upiIds[0]?.raw;

  if (!collectRow && has('RECEIVE_WITH_PIN')) {
    claims.push({
      claim: amount
        ? template('claimReceive', lang, { amount })
        : template('claimReceiveMoney', lang),
      reality:
        amount && upi
          ? template('realityPinSendsAmountTo', lang, { amount, upi })
          : amount
            ? template('realityPinSendsAmount', lang, { amount })
            : template('realityPinSendsMoney', lang),
      mismatch: true,
      signal: 'RECEIVE_WITH_PIN',
    });
  } else if (!collectRow && has('QR_TO_RECEIVE')) {
    claims.push({
      claim: amount
        ? template('claimReceive', lang, { amount })
        : template('claimReceiveMoney', lang),
      reality: amount
        ? template('realityQrPays', lang, { amount })
        : template('realityQrPaysMoney', lang),
      mismatch: true,
      signal: 'QR_TO_RECEIVE',
    });
  }

  if (has('AUTHORITY_CLAIM')) {
    const personalUpi = entities.upiIds.find((u) => u.looksPersonal)?.raw;
    const phone = entities.phones.find((p) => !p.indicator)?.raw;
    const reality = personalUpi
      ? template('realityAuthorityUpi', lang, { upi: personalUpi })
      : has('SECRECY') || has('STAY_ON_CALL')
        ? template('realityAuthorityCall', lang)
        : phone
          ? template('realityAuthorityPhone', lang, { phone })
          : null;
    if (reality)
      claims.push({
        claim: template('claimAuthority', lang),
        reality,
        mismatch: Boolean(personalUpi) || has('SECRECY') || has('STAY_ON_CALL'),
        signal: 'AUTHORITY_CLAIM',
      });
  }
  return claims;
}
