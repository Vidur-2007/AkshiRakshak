# Prompts — Laptop C (data, model, insights, evaluation, content)

Paste one prompt at a time into Claude Code, from the repo root. Start each phase in a fresh session (`/clear`); every prompt makes Claude re-read the specs and your progress log. Wait for the phase summary before moving on. If Claude Code stops part-way, use the "Resume" prompt at the end.

Your branch merges **first** at every checkpoint, because the engine depends on your model and content. Keep your phase timings.

## Before Phase 0 (human)

1. Install Node.js 22 LTS or newer, Python 3.11 or newer, Git, Claude Code; sign in with Laptop C's Claude account. Accept the GitHub collaborator invite from the team lead.
2. While Laptop A builds the skeleton (~45 minutes): read `docs/SPEC.md` §1–§3 and `docs/SPEC_C_DATA.md`. Start writing your 50 handwritten test messages (SPEC_C_DATA.md §3.5): realistic scam and genuine messages in languages you read well, roughly half scams, with invented numbers, UPI IDs and links. Ask B's and A's humans to write their 50 each and send them to you by end of Day 2. Do not show these to Claude Code until Phase 4.
3. When A says "Skeleton is on main": `git clone`, then `git checkout -b feat/data`, `npm install`, run `claude`, paste Phase 0.

---

## Phase 0 — Environment, taxonomy, generator skeleton (Day 1)

```text
You are Laptop C's Claude Code session for the Akshi Rakshak hackathon project. You own data, the model, statement insights, evaluation, content and the README. Branch: feat/data.

Read docs/SPEC.md completely, then docs/SPEC_C_DATA.md completely, then docs/progress/data.md. Read SPEC.md §6 (contracts) carefully: packages/model, packages/insights and packages/content currently contain stubs written by Laptop A with the exact public signatures. You will replace their internals; keep every exported name and signature.

Goal: a working Python environment and the foundations for the dataset.

Do:
1. ml/ layout and requirements from SPEC_C_DATA.md §2; create ml/.venv instructions in docs/progress/data.md (the human runs the venv commands if needed); pytest runs.
2. ml/akshi_ml/normalize.py: an exact port of normalizeText (SPEC.md §7.1) with tests on the same cases as the TS tests in packages/contracts.
3. data/ layout: data/messages/, data/templates/<category>/, data/fillers/, data/statements/, data/handwritten/.
4. The JSONL row schema (§3.1) as a validator in validate.py (schema checks first; quality checks come in Phase 1).
5. The template-family YAML format and slot list (§3.3) with three complete example families (one scam in English, one scam in romanised Hindi, one genuine bank OTP hard negative) and the generator skeleton that fills slots and writes JSONL.
6. Filler files for banks, brands, official domains, invented scam domains, fake phone numbers, fake UPI IDs, names, amounts by category.
7. data/handwritten/INSTRUCTIONS.md and TEMPLATE.csv (columns: text, lang, channel, label, category, author) for the team, explaining: invented numbers and IDs only, realistic wording, about half scams, never shown to the model during training.
8. A short taxonomy note in docs/dataset-card.md (draft): one paragraph per scam category describing how it reads in India and its tell-tale signs. This guides template writing.

Rules: only edit your owned paths (CLAUDE.md). No real personal data, real phone numbers, UPI IDs, account numbers or real private names. Invented scam domains are strings only; never fetch them.

Finish: run pytest and npm test; update docs/progress/data.md (Done, In progress, Deferred, Known issues, Requests); commit with conventional messages ("data: …"); push feat/data; print a summary for the human including the exact commands to create the Python venv if you could not run them.
```

---

## Phase 1 — The message dataset (Day 1)

```text
You are Laptop C's Claude Code session on Akshi Rakshak. Branch: feat/data. Read docs/SPEC.md, docs/SPEC_C_DATA.md and docs/progress/data.md first. Work only inside your owned paths.

Goal: the full synthetic message dataset, split by family, validated, plus the dataset-derived content.

Do, following SPEC_C_DATA.md §3 and §7:
1. Write template families for all 19 scam categories and for hard negatives, in en, hi (Devanagari and at least 35% romanised), te and bn, to reach the size targets in §3.2 with at most 25 rows per family and at least 5 families per category. Write from real knowledge of how these scams read in India (tone, misspellings, Hinglish, sender styles); vary length, formality and structure across families so the model cannot learn one template. Hard negatives must look genuinely like bank OTP SMS, debit alerts, UPI confirmations, delivery and e-commerce updates, utility bills with official links, bank promotions and government notifications.
2. Variants in generate.py (§3.3 step 3): casing, emoji, line breaks, spaced-out evasions, digit-for-letter swaps, romanised spelling variants.
3. Dedupe and full quality validation (§3.3 steps 5–6), including script/language agreement and checks that nothing resembles a real Aadhaar, PAN, card or account number, and that scam domains only come from the fillers list.
4. split.py: group-aware 70/15/15 by family, stratified by category where possible; a test that proves no family crosses splits.
5. Write data/messages/messages.jsonl (all synthetic rows with split set) and print a table of counts by language × label × split, and by category.
6. Content derived from the dataset (§7): SAMPLE_MESSAGES (12 items from the test split or written fresh, never train; include the three genuine ones), INDICATORS (~150 sample entries grouped into 8–12 campaigns, sampleData true), LANDSCAPE (counts, sampleData true). Replace the stubs in packages/content for these three exports; keep the other exports as they are for now. Add zod validation tests using schemas from @akshi/contracts.
7. Update docs/dataset-card.md with sizes, method, splits, hard negatives, safety rules and known biases (§3.6).

Acceptance: validator passes on every row; size targets met (report any shortfall honestly); pytest and npm test pass.

Finish: update docs/progress/data.md; commit; push feat/data; print a summary with the count tables.
```

---

## Phase 2 — Train, export, TypeScript inference, parity (Day 2 morning)

```text
You are Laptop C's Claude Code session on Akshi Rakshak. Branch: feat/data. Read docs/SPEC.md, docs/SPEC_C_DATA.md and docs/progress/data.md first. Work only inside your owned paths.

Goal: the trained classifier running in TypeScript with results identical to Python.

Do, following SPEC_C_DATA.md §4:
1. featurize.py: the analyzer exactly as §4.1 (lowercase, whitespace tokens with PUNCT stripping, word 1–2 grams prefixed "w:", char_wb 2–5 grams prefixed "c:" using scikit-learn's char_wb procedure). Unit tests against hand-computed examples, including Devanagari, Telugu, Bengali and emoji.
2. train.py (§4.2): scam model and L1 category model with C chosen on validation only; pruning to ≤ 20,000 features; vectorizer refit with the fixed vocabulary; retrain; validation report to stdout and ml/out/train-report.json.
3. Export (§4.3) to packages/model/model/scam-model.json with 5-decimal rounding and sparse category coefficients; record raw and gzipped size.
4. packages/model TypeScript (§4.4): replace the stub with loadModel (dynamic JSON import, memoised, null on missing/unknown format), predict with featurisation that records UTF-16 spans while iterating code points, tf-idf with sublinear tf and L2 norm, sigmoid, sparse softmax, top-25 contributions with spans; MODEL_VERSION from the JSON; loadCalibration with calibration.json defaults (§4.6).
5. parity.py → packages/model/test/parity-fixtures.json (200 validation texts across languages, including emoji and romanised Hindi); parity.test.ts asserting identical normalisation, |ΔpScam| < 1e-3 and identical category argmax.
6. A Vitest benchmark: predict ≤ 10 ms for a 2,000-character message.

Acceptance: parity test passes for all 200 texts; validation F1 reported (whatever it is — do not tune on test); npm test and pytest pass.

Finish: update docs/progress/data.md with validation metrics, model version and sizes; commit (include the model JSON); push feat/data; print a summary.
```

---

## Phase 3 — Statements, eval harness, content (Day 2) → Merge 1 (you merge first)

```text
You are Laptop C's Claude Code session on Akshi Rakshak. Branch: feat/data. Read docs/SPEC.md, docs/SPEC_C_DATA.md and docs/progress/data.md first. Work only inside your owned paths.

Build:
1. packages/insights (replace the stub; keep signatures), following SPEC_C_DATA.md §6: CSV format detection and parsing for canonical, bank_a and bank_b, Indian number formats, UPI narration parsing, errors with row numbers (never throw); categoriser; baseline; all seven rule anomalies with localised titles and explanations (en, hi, te, bn); Isolation Forest in TypeScript with the exact parameters, seeded PRNG and "why unusual" feature rows; statement riskScore and narrative templates; buildEntityGraph (§6.6).
2. ml/akshi_ml/statements.py: the three sample statements with labelled injected scenarios (§6.5) → data/statements/*.csv and *.labels.json; SAMPLE_STATEMENTS export with localised titles.
3. iforest_check.py: scikit-learn reference scores; a TS test asserting Spearman ≥ 0.8 against them for each sample statement.
4. eval/ as workspace package @akshi/eval (§5): run.ts with the four configs (full_ai_sample skipped unless an --ai flag is passed), metrics, per-language, per-category, fprGenuineBank, confusion matrix, latency, statement detection; writes packages/content/src/eval-report.json (validated with EvalReportSchema) and eval/out/report.md. It runs now against the stub engine (numbers meaningless); that is expected.
5. packages/content: EMERGENCY (§7 — general instructions only, contacts 1930, https://cybercrime.gov.in, https://sancharsaathi.gov.in/sfc/ for Chakshu with the "suspected fraud communication, not completed fraud" wording), FAQ (≥ 30 items, en + hi + te, bn where possible), first 6 DRILLS (en, hi, te; each with safe and scammed endings, feedback on every choice, redFlag on key moments), 4 PATTERN_CARDS (no statistics without a sourceUrl you opened). EVAL_REPORT imports eval-report.json. Zod tests for everything.

Then Merge 1 (you are first):
- git fetch, merge origin/main into feat/data (lockfile rule: take main's package-lock.json, npm install); run pytest, npm run typecheck, npm test.
- Push and open a PR feat/data → main with gh pr create if available; otherwise print the steps for the human. Tell the human to ask the team lead to merge it first.

Finish: update docs/progress/data.md; push; print a summary with the PR link.
```

---

## Phase 4 — Real-engine evaluation, error analysis, retrain, drills (Day 3 morning)

```text
You are Laptop C's Claude Code session on Akshi Rakshak. Branch: feat/data. Read docs/SPEC.md, docs/SPEC_C_DATA.md, docs/progress/data.md and (read-only) docs/progress/engine.md.

First: git fetch, merge origin/main into feat/data (lockfile rule); run all tests. The engine is now real.

Do:
1. Add the handwritten test set: the human will paste or place the team's messages in data/handwritten/*.csv. Convert them to data/messages/handwritten.jsonl with split "handwritten", validate, and do not look at model behaviour on them while tuning anything.
2. Run npm run eval (full_no_ai, rules_only, rules_model). Read the results for the validation split only (add a --split val option if needed).
3. Error analysis in docs/eval-notes.md: 20 false positives and 20 false negatives from validation, each with the reason and where the fix belongs (dataset, model, or engine rules — engine fixes go to Laptop A as Requests in docs/progress/data.md with concrete examples).
4. Fix dataset gaps you found (new families, more hard negatives), regenerate, re-split (families must stay stable — only add new families), retrain, re-export, rerun parity.
5. Calibration (§4.6): grid search thresholds and fusion weights on validation with the false-alarm constraint; write packages/model/model/calibration.json; record the choice and reasoning in eval-notes.
6. DRILLS to 10 (en, hi, te), PATTERN_CARDS to 8, check every SAMPLE_MESSAGES item gets its expected verdict from the real engine (test).
7. docs/i18n-review.md: the full checklist of localised files across the repo by language, with reviewer guidance (§8.2). Tell the human which team members should review which language.

Finish: rerun eval for all splits and write eval-report.json; update docs/progress/data.md and eval-notes; commit; push; print a summary including validation metrics before/after and the Requests you raised for Laptop A.
```

---

## Phase 5 — Final evaluation, README → Merge 2 (you merge first)

```text
You are Laptop C's Claude Code session on Akshi Rakshak. Branch: feat/data. Read docs/SPEC.md, docs/SPEC_C_DATA.md, docs/progress/data.md and (read-only) docs/progress/engine.md and docs/progress/web.md.

First: git fetch, merge origin/main (lockfile rule); run all tests.

Do:
1. Final eval on the test and handwritten splits with the current engine, model and calibration (no further tuning after this run). Include statement detection.
2. AI sample (§5.1): only if the human has put their own free Groq and Gemini keys in a local .env (never commit it) and started npm run dev:api; run full_ai_sample on ≤ 100 test messages, throttled to roughly one request every 4 seconds. Store metrics only.
3. Write the final packages/content/src/eval-report.json and eval/out/report.md. In notes, state plainly: synthetic test vs handwritten results, the false-alarm rate on genuine bank messages, and known weak spots.
4. Update docs/eval-notes.md with the final results and an honest commentary.
5. README.md (judge-facing, §8.3): every section listed, including credits for every open-source library (collect names from all package.json files and ml/requirements.txt) and every AI API, the dataset statement, how to run locally, env vars (check names against .env.example), the production URL from docs/progress/engine.md, and placeholders only where the video link and screenshots will go (mark them TODO for Phase 6).
6. Apply reviewer corrections in docs/i18n-review.md that belong to your content files.

Merge 2 (you are first): merge origin/main again, run pytest, typecheck, tests; push; open PR feat/data → main; tell the human to ask the team lead to merge it first.

Finish: update docs/progress/data.md; push; print a summary with the final metrics table and the PR link.
```

---

## Phase 6 — Demo script and submission (Day 4)

```text
You are Laptop C's Claude Code session on Akshi Rakshak. Branch: feat/data. Read docs/SPEC.md (§13 especially), docs/SPEC_C_DATA.md §8.4 and docs/progress/data.md. Code freeze is at midday.

First: merge origin/main; run all tests.

Do:
1. docs/demo-script.md: full narration (natural spoken English with one Hindi and one Telugu moment), the shot list for the SPEC.md §13.1 timeline with exact sample inputs, which device and route each shot uses, who records each part, target durations that add up to 4:30, and a backup plan if an AI provider is rate-limited (show the offline path).
2. A submission checklist in docs/demo-script.md: public repo, README complete, credits complete, no secrets or real personal data (search the repo and git history for key-like strings and 10–16 digit numbers), video under 5 minutes, live URL works on a phone, submission before 22 November 2026, 23:59 IST via the emailed link.
3. README: add the screenshots the human captures (place them in docs/screenshots/ — that folder is yours) and the video link when available; final metrics from eval-report.json.

Finish: update docs/progress/data.md; commit; push; open a small PR; print the checklist for the human.
```

---

## Utility prompts

### Resume after an interruption

```text
You are Laptop C's Claude Code session on Akshi Rakshak, branch feat/data. A previous session was interrupted. Read CLAUDE.md, docs/SPEC.md, docs/SPEC_C_DATA.md and docs/progress/data.md. Run git status and git log -10 to see where work stopped. Continue the current phase from where it stopped (ask me which phase if unclear). Finish with the usual steps: pytest, typecheck, tests, progress log, commit, push, summary.
```

### Retrain after data changes

```text
You are Laptop C's Claude Code session on Akshi Rakshak, branch feat/data. The dataset changed: <what changed>. Regenerate and validate the dataset, keep family splits stable (new families only), retrain with model selection on validation only, re-export with a bumped version, rerun parity and the model benchmark, rerun npm run eval on validation, and record the before/after metrics in docs/eval-notes.md. Commit and push.
```

### Merge main into my branch

```text
You are Laptop C's Claude Code session on Akshi Rakshak, branch feat/data. git fetch, then merge origin/main into feat/data. On a package-lock.json conflict take main's version and run npm install. Resolve other conflicts only inside your owned paths; for any other path take main's version. Run pytest, typecheck and tests, fix what is yours, commit, push, and summarise what changed.
```

### Add translations from a reviewer

```text
You are Laptop C's Claude Code session on Akshi Rakshak, branch feat/data. A reviewer sent these corrections for <language>: <paste>. Apply the ones that belong to packages/content and packages/insights; for files owned by other laptops, add them to docs/i18n-review.md under that owner with the exact old and new text. Update the "_review" status where a file is fully reviewed. Run tests, commit and push.
```
