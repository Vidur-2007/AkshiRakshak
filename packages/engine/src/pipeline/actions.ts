/**
 * "What to do now" (SPEC_A_ENGINE.md §8.6): ordered ActionId[] (max 5) from verdict,
 * category and signals. Any mention of money already sent puts `emergency` first.
 */
import type { ActionId, ScamCategory, Signal, SignalId, Verdict } from '@akshi/contracts';

const BY_CATEGORY: Readonly<Record<ScamCategory, readonly ActionId[]>> = {
  fake_kyc: [
    'do_not_click',
    'do_not_share_otp',
    'verify_official',
    'report_chakshu',
    'block_sender',
  ],
  digital_arrest: ['end_call', 'verify_official', 'report_1930', 'warn_family', 'block_sender'],
  upi_collect: ['decline_request', 'do_not_pay', 'block_sender', 'report_chakshu'],
  qr_receive: ['do_not_pay', 'block_sender', 'report_chakshu', 'warn_family'],
  bill_disconnection: ['do_not_pay', 'verify_official', 'block_sender', 'report_chakshu'],
  courier_customs: [
    'do_not_pay',
    'do_not_click',
    'verify_official',
    'report_chakshu',
    'block_sender',
  ],
  job_task: ['do_not_pay', 'block_sender', 'report_chakshu', 'warn_family'],
  investment_crypto: ['do_not_pay', 'verify_official', 'report_cybercrime_portal', 'warn_family'],
  loan_app: ['do_not_install', 'do_not_pay', 'report_cybercrime_portal', 'block_sender'],
  lottery_prize: ['do_not_pay', 'do_not_share_otp', 'block_sender', 'report_chakshu'],
  fake_customer_care: ['end_call', 'do_not_install', 'verify_official', 'report_chakshu'],
  refund_cashback: ['do_not_pay', 'decline_request', 'verify_official', 'report_chakshu'],
  wrong_transfer: ['verify_official', 'do_not_pay', 'call_bank', 'report_chakshu'],
  malicious_apk: ['do_not_install', 'do_not_click', 'report_chakshu', 'warn_family'],
  remote_access: ['do_not_install', 'end_call', 'call_bank', 'report_chakshu'],
  otp_theft: ['do_not_share_otp', 'call_bank', 'block_sender', 'report_chakshu'],
  romance: ['do_not_pay', 'verify_official', 'report_cybercrime_portal', 'block_sender'],
  impersonation_govt: ['verify_official', 'do_not_click', 'do_not_pay', 'report_cybercrime_portal'],
  phishing_link: ['do_not_click', 'verify_official', 'report_chakshu', 'block_sender'],
  other: ['verify_official', 'block_sender', 'report_chakshu'],
};

const BY_SIGNAL: Partial<Record<SignalId, ActionId>> = {
  ASKS_OTP: 'do_not_share_otp',
  ASKS_PIN: 'do_not_share_otp',
  ASKS_REMOTE_APP: 'do_not_install',
  APK_LINK: 'do_not_install',
  RECEIVE_WITH_PIN: 'decline_request',
  COLLECT_REQUEST: 'decline_request',
  QR_TO_RECEIVE: 'do_not_pay',
  STAY_ON_CALL: 'end_call',
};

/** "I already sent / paid", "money was debited" in four languages. */
export const MONEY_LOST =
  /\b(?:i|we)\s(?:have\s|already\s)?(?:sent|paid|transferred)\b|\bmoney\s(?:was\s|got\s|has\sbeen\s)?(?:deducted|debited|gone)\b|\blost\s(?:my\s)?money\b|maine paise (?:bhej|de)|मैंने (?:पैसे|रुपये) (?:भेज|दे)|पैसे कट गए|నేను డబ్బు పంపాను|డబ్బు పోయింది|আমি টাকা পাঠিয়েছি|টাকা কেটে নিয়েছে/iu;
const MENTIONS_BANK = /\bbank\b|\b(?:sbi|hdfc|icici|axis|kotak|pnb|yono)\b|बैंक|బ్యాంక|ব্যাংক|ব্যাঙ্ক/iu;

/**
 * `userText` is what the user wrote about their own situation (the collect-request note, or
 * their own chat turns). A scammer's "I sent you money by mistake" must not trigger `emergency`.
 */
export function chooseActions(
  verdict: Verdict,
  category: ScamCategory | null,
  signals: readonly Signal[],
  text: string,
  userText = '',
): ActionId[] {
  if (verdict === 'no_signs') {
    return MENTIONS_BANK.test(text)
      ? ['no_action_needed', 'verify_official']
      : ['no_action_needed'];
  }
  const out: ActionId[] = [];
  if (userText && MONEY_LOST.test(userText)) out.push('emergency', 'report_1930');
  out.push(...BY_CATEGORY[category ?? 'other']);
  for (const s of signals) {
    const a = BY_SIGNAL[s.id];
    if (a) out.push(a);
  }
  return [...new Set(out)].slice(0, 5);
}
