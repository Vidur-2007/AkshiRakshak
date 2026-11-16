# Evaluation notes

Kept by Laptop C. Numbers here are measured, not estimated. Nothing in this file was chosen by looking at the test or handwritten splits; when that changes, it will be said here.

## Training runs

### 2026.11.16-a (Phase 2, first model)

Data: `data/messages/messages.jsonl` as of Phase 1 — 1,683 training rows (783 scam) and 434 validation rows (214 scam). Command: `python -m akshi_ml.train` from `ml/`.

**Features.** TF-IDF over word 1–2 grams and character 2–5 grams (`char_wb`), sublinear tf, L2 norm, `min_df=2`: 45,910 features on the training split.

**Scam model** (logistic regression, liblinear, balanced classes). C chosen by validation F1:

| C | 0.5 | 1 | 2 | **4** | 8 |
|---|---:|---:|---:|---:|---:|
| validation F1 | 0.948 | 0.950 | 0.955 | **0.959** | 0.957 |

**Category model** (multinomial L1 logistic regression, saga, scam rows only). C chosen by validation macro-F1:

| C | 0.5 | 1 | 2 | 4 | 8 | **16** | 32 |
|---|---:|---:|---:|---:|---:|---:|---:|
| validation macro-F1 | 0.035 | 0.210 | 0.482 | 0.519 | 0.526 | **0.542** | 0.529 |
| non-zero weights | 2 | 23 | 154 | 487 | 844 | 1,203 | 1,758 |
| converged in 4,000 iterations | yes | yes | yes | no | yes | no | no |

The spec's grid was {0.5, 1, 2, 4}. On L2-normalised TF-IDF those values zero out almost every weight and the best one sat on the edge of the grid, so the grid was extended to 32. That was decided from validation scores only.

**Pruning and refit.** Kept the top 300 features per class of the category model plus the top 18,000 by |weight| of the scam model: 18,312 features. Vectorizer refitted on that vocabulary, both models retrained with C = 4 and C = 16.

**Validation results of the exported model** (model alone, threshold 0.5; this is not the engine's verdict):

| | Precision | Recall | F1 | Accuracy | False-alarm rate | n |
|---|---:|---:|---:|---:|---:|---:|
| Scam vs genuine | 0.925 | 0.986 | 0.955 | 0.954 | 0.077 | 434 |

| Language | Precision | Recall | False positives | False negatives | n |
|---|---:|---:|---:|---:|---:|
| en | 0.912 | 0.965 | 8 | 3 | 166 |
| hi | 1.000 | 1.000 | 0 | 0 | 126 |
| te | 0.800 | 1.000 | 8 | 0 | 72 |
| bn | 0.968 | 1.000 | 1 | 0 | 70 |

- False-alarm rate on hard negatives (genuine bank, OTP and UPI messages): **13.8%** (11 of 80). On other genuine messages: 4.3% (6 of 140).
- All 17 false positives come from six families: `bankinfo-te-01` (7), `chat-en-01` (4), `bankinfo-en-01` (3), `appt-te-01`, `debit-bn-01`, `school-en-01` (1 each). The bank advisories ("the bank never asks for your OTP or PIN", "KYC update is due, visit your branch") use the same words as the scams they warn about, and bag-of-n-grams features cannot see the negation.
- All 3 false negatives are from `otps-en-01` (casual "a code came to your phone by mistake, send it to me" messages with no bank or link words).

**Category model: weak, and why.** Validation macro-F1 0.535, accuracy 0.542. By language: en 0.674 (86 rows), hi 0.515 (66), te 0.438 (32), bn 0.333 (30). The dataset has one family per category per language (three English ones for the six priority categories). A validation family is therefore usually a category the model has never seen in that language, and word and character features do not carry over between scripts. More regularisation tuning does not fix this (see the flat part of the table above). The fix is in the data: at least two families per category per language, planned with the Phase 4 dataset work. Until then the engine should treat the model's category as a hint behind its own rules.

The final category model stopped at the 4,000-iteration limit before the solver's tolerance was reached. The weights that parity is tested against are the ones exported.

**Export.** `packages/model/model/scam-model.json`: 564,953 bytes raw, 122,118 bytes gzipped (budget 1.2 MB raw), 18,312 features, 1,183 non-zero category weights, floats rounded to 5 decimals.

**Parity.** 200 validation texts (50 en, 44 Devanagari Hindi, 24 romanised Hindi, 44 te, 38 bn; 32 with emoji): TypeScript normalisation identical, |ΔpScam| < 1e-3 and the same category argmax for all 200. The reference values come from the fitted scikit-learn objects, not from the exported JSON.

**Speed.** `predict` on a 2,000-character mixed-script message: median 0.72 ms, p95 0.85 ms on this laptop (budget 10 ms).

**Deviations from SPEC_C_DATA.md §4.**
- Lower-casing is done one code point at a time, not with a whole-string `lower()`. The two differ only for a Greek capital sigma at the end of a word. This keeps an exact map from each feature to its place in the text for highlights.
- Category C grid extended (above).
- A small `model/version.json` sits beside the model so `MODEL_VERSION` is available without loading the 565 KB model file.

## Calibration

`packages/model/model/calibration.json` holds the spec defaults (thresholds 70 / 40, fusion 0.45 / 0.35 / 0.20, AI blend 0.2). Tuning needs the real engine and happens in Phase 4.

## Error analysis, Isolation Forest validation, final results

Not started (Phases 3–5).
