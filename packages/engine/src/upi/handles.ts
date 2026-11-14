/**
 * UPI PSP handles (SPEC_A_ENGINE.md §6.3).
 * P1: handle → app table and the conservative "looks personal" heuristic.
 * P2: check against NPCI's published list of UPI apps and handles; add brand-claim mismatch.
 */
export const PSP_HANDLES: Readonly<Record<string, string>> = {
  // PhonePe
  ybl: 'PhonePe',
  ibl: 'PhonePe',
  axl: 'PhonePe',
  // Google Pay
  okaxis: 'Google Pay',
  okhdfcbank: 'Google Pay',
  okicici: 'Google Pay',
  oksbi: 'Google Pay',
  // Paytm
  paytm: 'Paytm',
  ptyes: 'Paytm',
  ptaxis: 'Paytm',
  pthdfc: 'Paytm',
  ptsbi: 'Paytm',
  // Amazon Pay
  apl: 'Amazon Pay',
  yapl: 'Amazon Pay',
  rapl: 'Amazon Pay',
  // BHIM
  upi: 'BHIM',
  // bank handles
  sbi: 'SBI',
  hdfcbank: 'HDFC Bank',
  icici: 'ICICI Bank',
  axisbank: 'Axis Bank',
  axis: 'Axis Bank',
  kotak: 'Kotak Mahindra Bank',
  kbl: 'Karnataka Bank',
  pnb: 'Punjab National Bank',
  barodampay: 'Bank of Baroda',
  cnrb: 'Canara Bank',
  unionbank: 'Union Bank of India',
  idfcbank: 'IDFC First Bank',
  yesbank: 'Yes Bank',
  indus: 'IndusInd Bank',
  fbl: 'Federal Bank',
  aubank: 'AU Small Finance Bank',
  jupiteraxis: 'Jupiter',
  fam: 'FamPay',
  freecharge: 'Freecharge',
  mbk: 'MobiKwik',
  ikwik: 'MobiKwik',
  waaxis: 'WhatsApp Pay',
  wahdfcbank: 'WhatsApp Pay',
  wasbi: 'WhatsApp Pay',
  waicici: 'WhatsApp Pay',
};

const MERCHANT_MARKERS =
  /(?:merchant|paytmqr|bharatpe|\.rzp|^pay\.|pay\.|store|shop|mart|^q\d{8,}|\bq\d{8,})/i;
const MOBILE_LOCAL = /^(?:91)?[6-9]\d{9}$/;
const NAME_LIKE = /^[a-z]+(?:[._-]?[a-z]+)*[._-]?\d{0,6}$/i;

export function pspOf(handle: string): string | undefined {
  return PSP_HANDLES[handle.toLowerCase()];
}

/** Heuristic; conservative. A 10-digit mobile or a name-like local part, with no merchant markers. */
export function looksPersonal(localPart: string): boolean {
  if (MERCHANT_MARKERS.test(localPart)) return false;
  return MOBILE_LOCAL.test(localPart) || NAME_LIKE.test(localPart);
}
