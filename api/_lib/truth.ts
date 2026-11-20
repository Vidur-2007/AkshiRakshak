/**
 * Truth rules for model-written text (SPEC.md §1.3): we never tell a user that a message, link or
 * payment is "safe" or "not a scam". The prompts already say so; this checks the output, because
 * a model can ignore instructions. A reply that breaks the rule is treated as invalid, so the next
 * provider is tried and, failing that, the app shows its own (local or FAQ) text instead.
 */

const EN =
  /\bsafe(?:ly)?\b|\bnot\s+(?:a\s+|an\s+)?(?:scam|fraud|phishing)\b|\bno\s+(?:risk|danger)\b|\bnothing\s+to\s+worry\b|\b(?:is|looks|seems|appears|are)\s+(?:\w+\s+)?(?:genuine|legitimate|legit|trustworthy|harmless)\b/i;

/** "safe" in Hindi, Telugu and Bengali (all forms share the stem). */
const INDIC = /सुरक्षित|సురక్షిత|নিরাপদ/;

/** True when the text calls something safe or harmless. */
export function claimsSafe(text: string): boolean {
  return EN.test(text) || INDIC.test(text);
}

// ───────────── evidence guard ─────────────
//
// A model can also state facts it never saw: "this number was reported by 120 users", "we have
// verified this is a fraud account", or a UPI ID, phone number or website that is not in the
// message. Those claims are not backed by any check we ran, so text that makes them is not shown
// (the score still counts; the app falls back to its own explanation).

/** Report or database claims: allowed only when our own lookup found the value. */
const REPORT_CLAIM =
  /\b(?:has|have|had)\s+been\s+(?:reported|flagged|blacklisted)\b|\b(?:was|were|is|are)\s+(?:reported|flagged|blacklisted)\b|\breported\s+by\b|\b\d[\d,]*\+?\s+(?:users|people|victims|reports|complaints|times)\b|\bblacklisted\b|\bknown\s+(?:scammer|fraudster|scam\s+(?:number|account|id)|fraud\s+(?:number|account|id))\b|\b(?:in|on)\s+(?:our|a|the)\s+(?:scam|fraud)\s+(?:database|list)\b/i;

/** "Verified" claims: no check we run can verify that something is a scam or genuine. */
const VERIFIED_CLAIM =
  /\b(?:verified|confirmed)\s+(?:as\s+|to\s+be\s+)?(?:an?\s+)?(?:scam|fraud|fake|scammer|fraudster|genuine|real|official)\b|\bwe\s+(?:have\s+)?(?:verified|confirmed|checked\s+with)\b|\b(?:bank|police|npci|rbi)\s+(?:has\s+)?confirmed\b/i;

/** a UPI ID, not an email address ("help@cybercrime.gov.in" continues with a dot) */
const UPI_ID = /[\w.-]{2,}@[a-z][a-z0-9]{1,63}\b(?!\.[a-z])/gi;
const PHONE = /(?<![\w+])\+?\d[\d -]{8,14}\d(?!\d)/g;
const DOMAIN =
  /\b(?:https?:\/\/)?((?:[a-z0-9-]+\.)+(?:com|in|net|org|xyz|top|site|online|info|link|me|io|app|co|gov|live|shop|club))\b/gi;
/** Official places the advice may name: government sites and the 1930 helpline. */
const OFFICIAL_DOMAIN = /(?:^|\.)(?:gov\.in|nic\.in|rbi\.org\.in|npci\.org\.in)$/i;

const digits = (s: string) => s.replace(/\D/g, '');

/**
 * True when the text states a fact the evidence does not support: a report count or database
 * hit (unless our own lookup found one: `reportsFound`), a "verified" claim, or a UPI ID, phone
 * number or website that is in neither `source` nor the official list.
 */
export function unsupportedClaim(text: string, source: string, reportsFound = false): boolean {
  if (!text) return false;
  if (!reportsFound && REPORT_CLAIM.test(text)) return true;
  if (VERIFIED_CLAIM.test(text)) return true;
  const src = source.toLowerCase();
  const srcDigits = digits(source);
  for (const m of text.matchAll(UPI_ID)) if (!src.includes(m[0].toLowerCase())) return true;
  for (const m of text.matchAll(PHONE)) {
    const d = digits(m[0]);
    // Indian mobile (6–9…) or toll-free 1800 numbers only: dates and amounts are not phone numbers
    const phoneLike = d.length >= 10 && (/^[6-9]/.test(d.slice(-10)) || d.startsWith('1800'));
    if (phoneLike && !srcDigits.includes(d.slice(-10))) return true;
  }
  for (const m of text.matchAll(DOMAIN)) {
    const host = (m[1] ?? '').toLowerCase();
    if (!OFFICIAL_DOMAIN.test(host) && !src.includes(host)) return true;
  }
  return false;
}
