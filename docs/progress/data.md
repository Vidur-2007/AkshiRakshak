# Progress — data

## Done

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

Nothing. Next: Phase 1 (full dataset, variants, quality validation, splits, SAMPLE_MESSAGES / INDICATORS / LANDSCAPE).

## Deferred

- Variants (casing, emoji, evasions, romanised spellings) and quality checks (script/language agreement, real-looking identifiers, domain allow-lists): Phase 1, as planned.
- `"sideEffects": false` in `packages/{model,insights,content}/package.json` and dropping the `@akshi/contracts/fixtures` import from content (A's request): done when the stubs are replaced in Phases 1–3.

## Known issues

- Python 3.11's `unicodedata` is Unicode 14.0; Node 26's ICU is Unicode 18.0. NFKC differs on 167 code points added after Unicode 14 (e.g. U+0558, U+209D–209F, blocks U+1CC00, U+1DF00, U+1E000). None are in Latin, Devanagari, Bengali, Telugu, punctuation, currency, emoji or full-width forms, so the dataset is unaffected. Python 3.14 (Unicode 16.0) would narrow but not close the gap.
- The handwritten CSV conversion (Phase 4) must skip rows whose author is `Example` (the template's sample rows).

## Requests

None yet. Noted from A's log (docs/progress/engine.md on feat/engine): `sideEffects: false` and no fixtures import in content; README env vars; parity fixtures at `packages/model/test/parity-fixtures.json`; list rule/lexicon/link false positives and negatives in `docs/eval-notes.md` for A.
