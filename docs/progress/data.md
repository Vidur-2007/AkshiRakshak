# Progress — data

## Done

### Phase 4 — real-engine eval, error analysis, retrain, calibration, drills, README (2026-11-18)

- **Merge:** `origin/main` (PR #1 only) fast-forwarded. A's PR #2 was still open, so `origin/feat/engine` was merged into `feat/data` to measure the real engine (engine 0.3.0). Once PR #2 is on `main`, this branch's diff shows only C's files. 526 tests passed straight after the merge.
- **First real report** (test split, model 2026.11.16-a): identical to A's rehearsal, full_no_ai P 97.4% / R 88.7% / F1 92.9%, 2.3% false alarms. Committed as soon as it ran, so the Proof page no longer shows "NOT A MEASUREMENT".
- **Error analysis, validation only** (`npm run errors -w @akshi/eval`): all 8 false positives are Telugu bank advisories where ASKS_PIN / ASKS_CVV_PASSWORD fire on "the bank never asks…"; 27–29 false negatives where the model is confident (60–89) but no rule fires. Details and the list for A: `docs/eval-notes.md`.
- **Dataset:** 76 new families (3,579 rows, was 2,550); every earlier row and split unchanged. Leads (a) Bengali/Telugu genuine messages and (b) guaranteed/daily returns addressed with data; lead (d) respected (no bare URLs, UPI IDs, phones or QR payloads added).
- **Model 2026.11.18-a:** validation F1 0.963 (was 0.955), false alarms 5.3% (was 7.7%), category macro-F1 0.650 (was 0.535; lead c). Saga now converges (12,000 iterations). Parity 200/200. INDICATORS and LANDSCAPE regenerated.
- **Calibration** (`npm run calibrate -w @akshi/eval`, validation only): chosen rules 0.30 / model 0.35 / links 0.35, thresholds 70 / 40, AI blend 0.2. Validation F1 92.2% → 97.6%, false negatives 29 → 5. Bank false alarms 5.0% → 3.75%, so **the 3% limit is not met**: the remaining 6 are a rules negation bug that no setting with suspicious ≤ 45 can hide (a higher threshold would switch off A's 45-point OTP and returns floors). **Shipped on `feat/data`: the defaults.** The tuned file is on `feat/data-calibration` (draft PR), because two of A's tests hard-code the default weights (request below).
- **Final test report on this branch** (model 2026.11.18-a, default calibration, 527 messages): P 91.6% / R 88.3% / F1 89.9%, false alarms 7.1%, bank 14.3%. The test split grew by six Phase 4 families; on the original 433 messages the numbers equal the rehearsal (F1 92.9%), and the new false alarms are one Telugu advisory family (`bankinfo-te-02`, 15 of 20) with the same negation bug. With the tuned calibration: F1 93.4%.
- **Content:** drills 7–10 (OTP from a fake bank call, ₹25 parcel fee, screen-sharing helpline, guaranteed-returns group; en/hi/te), pattern cards 5–8 (en/hi/te/bn). `eval/test/samples.test.ts` runs all 12 SAMPLE_MESSAGES through the real engine offline; `sample-job-te` now expects `scam` (scores 72; it asks a registration fee).
- **Handwritten set:** converter ready (`python -m akshi_ml.handwritten`; authors become hw-a, hw-b, …; same identifier checks; nothing is written if any row fails). **The team's CSVs have not arrived**, so there is no handwritten result yet.
- **Docs:** README (env vars exactly as `api/` reads them), `docs/i18n-review.md`, eval notes, dataset card.
- Checks: typecheck clean, lint clean, 542 JS tests and 104 Python tests pass.

### Phase 3 — statements, Isolation Forest, eval harness, content (2026-11-17)

Checks: `npm run typecheck`, `npm test` (175), `npm run lint`, `cd ml && .venv/bin/pytest` (100). Regenerate statements with `python -m akshi_ml.statements && python -m akshi_ml.iforest_check` from `ml/`; run the harness with `npm run eval` (options in `eval/src/run.ts`).

- **`packages/insights`** (stub replaced, signatures kept):
  - CSV parsing for the canonical, `bank_a` and `bank_b` formats: quoted cells, Indian amounts (`1,00,000.00`), several date formats, UPI narration parsing. Every bad row is reported as `Row N: reason`; it never throws.
  - Categoriser following §6.2.
  - Baseline: median, p90, usual hours, frequent payees.
  - All seven rule anomalies, with titles, explanations and "why unusual" rows in en, hi, te and bn.
  - Isolation Forest in TypeScript with the exact §6.4 parameters and the mulberry32 seed 42.
  - Risk score and a 2–3 sentence narrative in four languages.
  - `buildEntityGraph`: normalised values, `appears_with` and `part_of` edges, campaign nodes, cluster stats.
- **Two choices that go beyond the spec text:**
  - A payee who is paid again a week or more later is not treated as "new" on its first row. A statement starts mid-life, so without this rent, suppliers and the regular shop all looked new.
  - An Isolation Forest flag is shown only when the payment is also unusual for that payee. Without that filter, regular payments such as EMI, SIP and rent were flagged on all three samples.
- **Sample statements** (`ml/akshi_ml/statements.py`), all 90 days, written to `data/statements/*.csv`, `*.labels.json` and the bundled `SAMPLE_STATEMENTS`:

  | Statement | Rows | Planted scenarios |
  |---|---:|---|
  | student | 150 | 4 × ₹499 burst; ₹1 credit, then ₹9,999 at 23:40 |
  | salaried | 177 | ₹48,000 at 02:47; a ₹1,299 double charge |
  | shop | 390 | ₹5,000 credit, then ₹5,000 back within 3 h; a round ₹20,000 |

  **All 6 scenarios are flagged, with no other flags**, in every language. Risk scores: salaried 63, student 80, shop 70.
- **Isolation Forest vs scikit-learn** (`iforest_check.py`, same feature rows): Spearman **0.978** (salaried), **0.985** (student), **0.975** (shop). The target was at least 0.8.
- **`eval/` (`@akshi/eval`)**:
  - Runs `rules_only`, `rules_model` and `full_no_ai`, plus `full_ai_sample` with `--ai` (at most 100 messages, one every 4 s). Network extras are off.
  - Reports metrics counting scam+suspicious as flagged, with scam-only figures in the notes. Also per language, per category, the false-alarm rate on hard negatives, a 3 × 3 confusion table, latency p50/p95, and statement detection.
  - Writes `packages/content/src/eval-report.json` (schema-checked) and `eval/out/report.md`.
  - `--split val` and `--limit` write only to `eval/out/`, so tuning runs never reach the Proof page.
  - The notes say "NOT A MEASUREMENT" whenever the engine version contains "stub".
- **Content**:
  - `EMERGENCY`: 6 questions and 9 steps in four languages, following §7.
  - `FAQ`: 33 items in four languages, all §7 topics. The 5 ids the engine and web already use are kept.
  - `DRILLS`: 6 drills in en, hi and te (collect refund, fake KYC, marketplace QR, electricity, digital arrest, task job), each with 5–7 nodes. Each has safe and scammed endings, feedback on every choice and red flags; tests check every node is reachable and there are no cycles.
  - `PATTERN_CARDS`: 4 cards in four languages, with no statistics.
  - `EVAL_REPORT` now comes from the harness JSON. Content no longer imports `@akshi/contracts/fixtures`, and `"sideEffects": false` is set on model, insights and content (A's request).

### Phase 2 — train, export, TypeScript inference, parity (2026-11-16)

Rerun from `ml/`: `.venv/bin/python -m akshi_ml.train --version <YYYY.MM.DD-letter>` (about 4 minutes), then `.venv/bin/python -m akshi_ml.parity`, then `.venv/bin/pytest` (95 tests) and `npm test` (107). Details and tables: `docs/eval-notes.md`.

- **Model `2026.11.16-a`**, validation only: scam vs genuine **F1 0.955** (precision 0.925, recall 0.986, false-alarm rate 7.7%; 13.8% on hard negatives). Category macro-F1 **0.535** (weak; see Known issues). Chosen C: scam 4, category 16.
- **Export** `packages/model/model/scam-model.json`: 18,312 features, 565 KB raw, 122 KB gzipped. `model/version.json` (version, metrics, sizes) and `model/calibration.json` (spec defaults).
- **`featurize.py`** and **`packages/model/src/featurize.ts`**: the same analyzer (word 1–2 grams, `char_wb` 2–5 grams); the Python one is checked against scikit-learn's own `char_wb`, the TypeScript one against feature lists written by Python.
- **`train.py`**: selection on validation, pruning (300 per category class + top 18,000 scam weights, cap 20,000), vectorizer refit on the kept vocabulary, retrain, export with 5-decimal rounding and sparse category weights, `ml/out/train-report.json`. Never reads the test or handwritten splits.
- **`packages/model`** (stub replaced, signatures kept): `loadModel()` (dynamic JSON import, memoised, `null` on a missing or unknown model), `predict` (sublinear tf-idf, L2 norm, sigmoid, sparse softmax, category only when pScam ≥ 0.4, top-5 category probabilities, top-25 positive contributions with merged UTF-16 spans), `MODEL_VERSION`, `loadCalibration()` (falls back to the defaults as a whole when the file is invalid). No runtime dependency on zod; `"sideEffects": false`.
- **Parity**: 200 validation texts in all four languages, 32 with emoji, 24 romanised Hindi — identical normalisation, |ΔpScam| < 1e-3 and the same category argmax for all 200.
- **Speed**: `predict` on 2,000 characters: median 0.72 ms (budget 10 ms).

### Phase 1 — the message dataset (2026-11-16)

Rebuild everything from `ml/`: `.venv/bin/python -m akshi_ml.build_dataset && .venv/bin/python -m akshi_ml.export_content`, then `.venv/bin/pytest` (84 tests) and `npm test` (77).

- **Dataset** `data/messages/messages.jsonl`: **2,550 rows, 174 families** (1,210 scam, 1,340 genuine, 480 hard negatives). Every §3.2 target is met; 0 validation problems.

  | lang | label | train | val | test | total | target |
  |---|---|---:|---:|---:|---:|---:|
  | en | scam | 278 | 86 | 88 | 452 | 450 |
  | en | legit | 360 | 80 | 80 | 520 | 500 |
  | hi | scam | 223 | 66 | 65 | 354 | 350 |
  | hi | legit | 260 | 60 | 60 | 380 | 380 |
  | te | scam | 140 | 32 | 30 | 202 | 200 |
  | te | legit | 140 | 40 | 40 | 220 | 220 |
  | bn | scam | 142 | 30 | 30 | 202 | 200 |
  | bn | legit | 140 | 40 | 40 | 220 | 220 |

  Hard negatives: en 180, hi 140, te 80, bn 80. Romanised share of Hindi: 43%. The six priority categories have 89 rows in 7 families each; the other 13 have 52 rows in 5 families each. Full category table: `docs/dataset-card.md`.
- **Families** (`data/templates/`): 107 scam families (19 categories × en, Devanagari Hindi, romanised Hindi, Telugu, Bengali; 3 English families for priority categories) and 67 genuine families (bank OTP, debit/credit, UPI confirmations, card, EMI, bank advisories and offers, courier, orders, bills, telecom, government, appointments, travel, school, work, everyday chat, money talk between friends). 735 templates.
- **`generate.py`**: macros `[#N]` (random digits) and `[ref]` (12-digit reference starting 0/1); variants (casing, emoji, line breaks, spaced-out evasions, digit-for-letter brand swaps, romanised Hindi spellings, short forms) that never touch links, UPI IDs or phones; a per-template cap so one template cannot fill a family; dedupe (exact match ignoring case, spacing, punctuation and emoji across the dataset; 5-gram Jaccard > 0.9 inside a family).
- **`validate.py`** quality checks: script/language agreement, PAN / Aadhaar / card / account look-alikes, invented phone prefixes, scam domains only from the fillers, genuine links only to official domains, no mobile numbers in genuine rows. `--schema-only` skips them. Handwritten rows skip the filler-list checks but not the identifier checks.
- **`split.py`**: family-level 70/15/15 inside strata (scam category; genuine language + hard-negative flag), balanced by language; assignments stored in `data/messages/splits.json` and never changed once made. Actual rows: 66% / 17% / 17% (114 / 30 / 30 families), because one family of five is already 20%.
- **`build_dataset.py`**: generate → split → validate → write, with the count tables and `data/messages/stats.json`. Writes nothing if a row fails or a family comes up short.
- **Content** (`packages/content`): `SAMPLE_MESSAGES` (12, labels in four languages, written fresh), `INDICATORS` (150: 63 domains, 37 UPI IDs, 50 phones, 12 campaigns; `reports` = number of dataset rows containing the value), `LANDSCAPE` (scam rows by category, language, channel). Indicators and landscape are generated by `ml/akshi_ml/export_content.py` into JSON; a pytest fails if the committed JSON does not match the dataset. Other exports are still the Phase 0 stubs.
- **Kept for the other laptops:** the six stub sample ids and texts (`sample-fake-kyc` first) and the ten stub indicators with their report counts (first ten entries, `INDICATORS[0]` unchanged), because tests on `feat/engine` and `feat/web` look them up.
- **`docs/dataset-card.md`**: sizes, method, splits, hard negatives, safety rules, known biases, what it must not be used for.

### Phase 0 — environment, taxonomy, generator skeleton (2026-11-16)

- **Python environment** (`ml/`): `requirements.txt` pinned (numpy 2.4.6, pandas 3.1.1, pytest 9.2.0, PyYAML 6.0.3, scikit-learn 1.9.1, scipy 1.17.1); `pytest.ini`; `ml/.gitignore`. Python 3.11.16 on this laptop. Create the venv from the repo root:
  ```bash
  python3.11 -m venv ml/.venv
  ml/.venv/bin/pip install -r ml/requirements.txt
  cd ml && .venv/bin/pytest            # 44 tests
  ```
- **`normalize.py`**: exact port of `normalizeText`, with the same cases as `packages/contracts/test/normalize.test.ts`. Whitespace uses JavaScript's `\s` set (Python's `\s`/`strip()` also match U+001C–U+001F and U+0085). Cross-checked against the TS function on every Unicode code point: identical for everything this project handles (see Known issues for the rest).
- **`contracts.py`**: LANGS, CHANNELS, SCAM_CATEGORIES mirrored from `@akshi/contracts`; a test parses `schemas.ts` and fails if they drift.
- **`data/` layout**: `messages/`, `templates/<category>/`, `fillers/`, `statements/`, `handwritten/`.
- **`validate.py`**: JSONL row schema (§3.1): exact keys and types, enums, scam ⇒ category / legit ⇒ null, hard negatives only on legit, Hindi script deva/latn/mixed, split rules, id `<family>-NNN` matching the family, unique ids. CLI: `python -m akshi_ml.validate <files> [--require-split]`.
- **`generate.py`**: family YAML format (documented in the module docstring), family checks (file name = family id, folder = category or `legit`, known slots only, ≤ 25 rows), seeded per-family generation, slot filling for all 12 slots (a slot keeps its value within a row; legit `{link}` uses the domain of the bank/brand named in the same row), Indian number grouping, dedupe within a family on normalised text. CLI: `python -m akshi_ml.generate --out <file>`.
- **Three example families**: `fake_kyc/kyc-en-01` (scam, en), `digital_arrest/arrest-hir-01` (scam, romanised Hindi), `legit/otp-en-01` (genuine bank OTP, hard negative). 75 rows, 0 validation problems.
- **Fillers**: banks (12, official domains as in the engine registry), brands by kind, official domains, invented scam domains by theme, invented phone patterns (+ the regex the validator will use), invented UPI IDs by theme, names and officials per script, amount ranges per category and formats per script, apps, deadlines in 4 languages + Hinglish, date/time formats.
- **Handwritten set**: `data/handwritten/INSTRUCTIONS.md` and `TEMPLATE.csv` (text, lang, channel, label, category, author).
- **`docs/dataset-card.md`** draft: purpose, safety rules, one paragraph per scam category, hard negatives.

## In progress

Phase 4 PR (`feat/data` → `main`) and the stacked calibration PR (`feat/data-calibration`, draft until A's test change). Next: Phase 5 (handwritten results, AI sample run, final report).

## Deferred

- **Handwritten results:** waiting for the team's CSVs in `data/handwritten/`. Then `cd ml && .venv/bin/python -m akshi_ml.handwritten`, then `npm run eval`.
- **Tuned calibration:** on `feat/data-calibration` until A's two tests read `loadCalibration()`. Rerun `npm run calibrate -w @akshi/eval` after A's rule fixes; the 3% bank limit should then be reachable.
- AI sample run (`npm run eval -w @akshi/eval -- --ai`, needs keys): Phase 5. `aiBlend` stays 0.2 until then.
- Bengali drills: not planned. `script: mixed` rows: none yet.
- README live link, demo video, screenshots and team names: before submission.

## Known issues

- **Bank false alarms are above 3%:** validation 5.0% (3.75% with the tuned calibration), test 14.3%. Almost all are Telugu and Bengali advisories ("the bank never asks for your PIN / OTP") where the rules miss the negation. Needs A's rule fix; calibration cannot fix it without switching off the 45-point floors.
- **The test split changed composition** (433 → 527) because new families are assigned to all splits. Numbers are not comparable with A's rehearsal without the subset split in `docs/eval-notes.md`.
- **UPI IDs before a full stop are not extracted by the engine** (6 of 38 validation scams with a UPI ID); reported to A.
- The statement rules and samples were written together; 6 of 6 caught shows the rules work, not real-world performance.
- Hindi, Telugu and Bengali text (templates, drills, FAQ, emergency steps, pattern cards, statement strings) is unreviewed; checklist in `docs/i18n-review.md`.
- The category model is still weaker outside English (te 0.55, bn 0.61 accuracy) and its C is at the top of the grid.
- Scam links are drawn from a themed pool without matching the bank named in the message.
- Date and time slots use Latin formats in every language.
- `loadModel()` uses a plain JSON `import()`; plain Node ESM without a bundler would need an import attribute.
- Python 3.11 NFKC is Unicode 14.0, Node's ICU is newer; differs only on code points outside the scripts used here.
- `npm run eval -- --split val` at the root drops the flag (root script runs every workspace); use `npm run eval -w @akshi/eval -- --split val`.

## Requests

- **To A — calibration tests (blocks the tuned calibration):** `packages/engine/test/fusion.test.ts` "renormalises over available, relevant layers" and `packages/engine/test/model.test.ts` "blends the model score per §8.2 and adds MODEL_PATTERN" compute the expected score with the hard-coded defaults (0.45 / 0.35 / 0.20) but the engine reads C's `calibration.json`. With rules 0.30 / model 0.35 / links 0.35 they fail (expected 42 got 51; expected 64 got 70). Please take the weights from `loadCalibration()` in those two tests, or mock it to the defaults as `calibration.test.ts` does. Then merge `feat/data-calibration`.
- **To A — negation in the rules (Telugu first):** ASKS_PIN, ASKS_CVV_PASSWORD and SECRECY fire on bank advisories that say the bank will *not* ask ("… పిన్ ఎంటర్ చేయడం అవసరం లేదు", "… పాస్‌వర్డ్ అడగదు", "వాటిని ఎవరికీ చెప్పకండి"). 8 of 8 validation false positives and 15 of 20 in one test family. Also check Bengali genuine bank messages (5 of 20 in the original test families). Examples with scores: `docs/eval-notes.md`, "For A".
- **To A — UPI extraction:** a UPI ID followed by "." or "।" ("send ₹1,700 to daily.task.reward@ibl. All members…") is not extracted; without the full stop it is, matches the indicator and scores 95.
- **To A — lexicon gaps** (all from validation, texts in `docs/eval-notes.md`): ASKS_OTP for "reply with the OTP" / "send me the 6 digit code"; QR_TO_RECEIVE for "to receive … scan this QR"; spaced "P.I.N" as PIN; TASK_JOB_PAYMENT / ADVANCE_FEE for "recharge … to withdraw", "combo task", "funds frozen" (en, bn); Hinglish WRONG_TRANSFER_RETURN and RECEIVE_WITH_PIN ("galat … chala gaya", "accept karke PIN daal do"); Telugu SECRECY / STAY_ON_CALL / THREAT_LEGAL / ADVANCE_FEE / TOO_GOOD_RETURNS; Bengali loan-harassment threat ("ছবি … সব কন্টাক্টে"); a romance / stranded-abroad pattern in Hindi.
- **To A (information):** the eval workspace runs fine under the root `typecheck`; request 1 from Merge 1 is closed. Request 2 (honour `options.layers`) is closed by A's `layers.test.ts`.
