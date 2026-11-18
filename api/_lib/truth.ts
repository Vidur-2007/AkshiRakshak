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
