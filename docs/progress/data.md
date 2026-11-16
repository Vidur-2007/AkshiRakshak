# Progress — data

## Done

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

Nothing. Next: Phase 3 (statements, Isolation Forest, eval harness, EMERGENCY / FAQ / drills) and Merge 1.

## Deferred

- `"sideEffects": false` in `packages/{model,insights,content}/package.json` and dropping the `@akshi/contracts/fixtures` import from content (A's request): the import goes when `EVAL_REPORT` gets its own JSON in Phase 3.
- Handwritten set (150 messages from the team): converted and validated in Phase 4.
- `script: mixed` rows (Devanagari and Latin in one message): the schema and validator support them, no family uses them yet.

## Known issues

- **The model's category is unreliable outside English** (validation accuracy: en 67%, hi 52%, te 44%, bn 33%). There is one family per category per language, so a held-out family is a category the model never saw in that language. Fix planned for Phase 4: a second family per category per language, then retrain. Until then the engine should prefer its own rules for the category.
- **False alarms on genuine bank advisories**: 11 of 80 validation hard negatives score above 0.5, mostly "the bank never asks for your OTP" and "visit your branch for KYC" messages in Telugu and English. The model cannot see the negation; the engine's SAFETY_ADVICE and OFFICIAL_DOMAIN signals have to pull these down, and calibration in Phase 4 has to hold the 3% limit.
- The category model stops at the 4,000-iteration limit before converging at the chosen C.
- `loadModel()` uses a plain `import('../model/scam-model.json')`. Vite, Vitest and tsx accept it; plain Node ESM without a bundler would need an import attribute.
- **Telugu, Bengali and Hindi templates are unreviewed.** They were drafted by Claude and need a native reader (the i18n checklist comes in Phase 4). Wrong or stiff wording here goes straight into the model.
- Scam links are picked from a themed pool without matching the bank named in the message (an "SBI" message may carry an `icici-…` invented domain). Real scams are often this careless, but it is not deliberate modelling.
- Date and time slots use Latin formats in every language ("14-Nov-26", "07:49 PM" inside Telugu or Bengali text).
- `SAMPLE_MESSAGES[].expected` has not been checked against the real engine (it is not on this branch); that test is a Phase 4 item. `sample-wedding-apk-bn` and `sample-wrong-transfer-te` are the ones most likely to need a different expected verdict.
- Python 3.11's `unicodedata` is Unicode 14.0; Node 26's ICU is Unicode 18.0. NFKC differs on 167 code points added after Unicode 14 (e.g. U+0558, U+209D–209F, blocks U+1CC00, U+1DF00, U+1E000). None are in Latin, Devanagari, Bengali, Telugu, punctuation, currency, emoji or full-width forms, so the dataset is unaffected.
- The handwritten CSV conversion (Phase 4) must skip rows whose author is `Example` (the template's sample rows).

## Requests

None yet. For A, information only: the model's `category` is a weak signal for now (see Known issues); `pScam` is the dependable output. Noted from A's log (docs/progress/engine.md on feat/engine): `sideEffects: false` and no fixtures import in content; README env vars; parity fixtures at `packages/model/test/parity-fixtures.json`; list rule/lexicon/link false positives and negatives in `docs/eval-notes.md` for A.
