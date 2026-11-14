# Laptop C — Data, model, insights, evaluation and content

Owner: Laptop C. Branch: `feat/data`. Read `SPEC.md` first; this file adds detail and never overrides it.

You own: `packages/model`, `packages/insights`, `packages/content` (A created stubs in Phase 0; you replace them), `ml/`, `data/`, `eval/`, `README.md`, `docs/progress/data.md`, `docs/dataset-card.md`, `docs/eval-notes.md`, `docs/i18n-review.md`, `docs/demo-script.md`, `docs/screenshots/`.

Your branch merges first at every checkpoint, because the engine depends on your model and content.

---

## 1. Deliverables by phase

| Phase | When | Deliverable |
|---|---|---|
| P0 | Day 1 | Python env in `ml/`, folder layout, dataset schema and validator, scam taxonomy notes, template-family format, generator skeleton, handwritten test-set instructions for the team |
| P1 | Day 1 | Full message dataset (≈2,500 rows, four languages, hard negatives), family-level splits, dedupe, dataset card, `SAMPLE_MESSAGES`, `INDICATORS`, `LANDSCAPE` |
| P2 | Day 2 morning | Featuriser (Python and TS, identical), training (scam + category), pruning and refit, JSON export, TS inference with contributions and spans, parity test, `calibration.json` defaults |
| P3 | Day 2 | Statement parser, categoriser, rule anomalies, Isolation Forest (TS) validated against scikit-learn, sample statements with labelled scenarios, narrative; eval harness (`@akshi/eval`); `EMERGENCY`, `FAQ` (≥ 30), first 6 drills. **M1 (you merge first).** |
| P4 | Day 3 morning | Eval on the real engine, error analysis (`docs/eval-notes.md`), dataset fixes and retrain, calibration tuned on validation, drills to 10, entity graph builder, pattern cards, handwritten set added |
| P5 | Day 3 | Final eval including the AI sample, `EVAL_REPORT` committed, i18n review checklist, README. **M2.** |
| P6 | Day 4 | Demo script and shot list, submission checklist, README screenshots and final numbers |

---

## 2. Python environment (`ml/`)

- Python 3.11 or newer, virtual env at `ml/.venv` (gitignored). `ml/requirements.txt` pinned: scikit-learn, pandas, numpy, scipy, pytest, pyyaml.
- Layout:

```
ml/
  requirements.txt
  akshi_ml/
    normalize.py      port of normalizeText (SPEC.md §7.1)
    featurize.py      analyzer shared by training and parity fixtures
    generate.py       dataset generator from template families
    validate.py       schema + quality checks
    split.py          family-level splits
    train.py          train, prune, refit, export
    statements.py     sample statement generator with labelled scenarios
    iforest_check.py  scikit-learn IsolationForest reference scores
    parity.py         writes parity fixtures for the TS tests
  tests/
```

- Everything runs from the command line (`python -m akshi_ml.train`), so Claude Code can rerun it whenever the data changes. No notebooks, Kaggle or Colab.

---

## 3. Message dataset (`data/messages/`)

### 3.1 Row schema (JSONL)

```json
{"id":"kyc-hi-03-007","text":"...","lang":"hi","script":"deva","channel":"sms",
 "label":"scam","category":"fake_kyc","family":"kyc-hi-03","split":"train",
 "source":"synthetic","hard_negative":false,"notes":""}
```

- `label`: `scam` or `legit`. `category`: a `ScamCategory` for scams, `null` for legit.
- `script`: `latn`, `deva`, `telu`, `beng`, `mixed`. Romanised Hindi rows have `lang: "hi"`, `script: "latn"`.
- `split`: `train`, `val`, `test`, `handwritten`.
- `source`: `synthetic` or `handwritten`.

### 3.2 Size targets

| Language | Scam | Legit (of which hard negatives) |
|---|---|---|
| en | 450 | 500 (180) |
| hi (Devanagari + romanised, at least 35% romanised) | 350 | 380 (130) |
| te | 200 | 220 (80) |
| bn | 200 | 220 (80) |
| **Total** | **1,200** | **1,320 (470)** |

Every one of the 19 scam categories (all except `other`) has at least 40 rows across languages and at least 5 families. `fake_kyc`, `phishing_link`, `upi_collect`, `job_task`, `digital_arrest` and `bill_disconnection` get more.

### 3.3 Generation method

1. **Template families** (`data/templates/<category>/<family>.yaml`): Claude Code writes each family as a short scam (or legit) message pattern in one language with slots: `{bank}`, `{brand}`, `{amount}`, `{link}`, `{phone}`, `{upi}`, `{name}`, `{date}`, `{time}`, `{deadline}`, `{app}`, `{otp}`. Write families from knowledge of how these scams actually read in India: tone, typical misspellings, Hinglish mixing, sender styles (bank short codes like `VM-HDFCBK` for legit; 10-digit numbers for scams).
2. **Slot fillers** (`data/fillers/*.yaml`): banks, brands, amounts (realistic ranges per category), invented scam domains (`sbi-kyc-update.xyz`, `hdfc-netbanking-verify.top`, `indiapost-redelivery.info`), official domains for legit rows, fake phone numbers (`98765 0xxxx` style), fake UPI IDs (`refund.desk2026@ybl`), Indian names.
3. **Variants** (`generate.py`): slot filling, casing changes, emoji, line breaks, spaced-out evasions ("O T P", "K.Y.C"), digit-for-letter swaps in brand names, romanised Hindi spelling variants (`aapka/apka`, `khata/khaata`), short/long forms. Each family yields at most 25 rows, to keep near-duplicates down.
4. **Hard negatives**: genuine-style OTP messages with "do not share", debit/credit alerts, UPI payment confirmations, delivery updates from official domains, e-commerce order messages, utility bills that point to official sites, bank promotional SMS, government scheme notifications on `gov.in` domains, appointment reminders. These are the rows that stop the model flagging every message that mentions OTP, a bank or a link.
5. **Dedupe**: drop rows whose normalised text matches another row exactly, and rows with character 5-gram Jaccard similarity > 0.9 to another row in the same family.
6. **Validate** (`validate.py`): schema, categories, language/script detection agrees with the label, no row contains anything that looks like a real Aadhaar, PAN, card or account number, and every domain in a scam row is from the fillers list (no accidental real domains).

### 3.4 Data safety rules

- All data is synthetic or written by the team. No scraped personal messages, no real phone numbers, UPI IDs, account numbers or names of real private people.
- Invented scam domains may coincidentally exist on the internet. Never visit them; they exist only as strings.
- The dataset card states all of this.

### 3.5 Splits

- `split.py` uses group-aware splitting by `family`: 70% train, 15% val, 15% test, stratified so each category appears in every split where possible. No family appears in two splits.
- **Handwritten test set** (`data/messages/handwritten.jsonl`): 150 messages written by the three team members (about 50 each, roughly half scam, spread over languages they read), never used for training or tuning. Your Phase 0 prompt creates `data/handwritten/INSTRUCTIONS.md` and `data/handwritten/TEMPLATE.csv` for the team; the humans write them on Day 1–2 and send them to Laptop C's human, who commits them.

### 3.6 Dataset card (`docs/dataset-card.md`)

Purpose, sizes per split/language/category, generation method, hard negatives, splitting method, known biases (synthetic phrasing, limited regional variety, English-heavy), what it must not be used for, and the data safety rules.

---

## 4. Model

### 4.1 Featuriser (identical in Python and TypeScript)

Input: text already passed through `normalizeText` (Python port in `normalize.py`, parity-tested against the TS version in `@akshi/contracts`).

1. `t = text.lower()` (TS: `toLowerCase()`).
2. **Word tokens**: split `t` on whitespace; strip characters in `PUNCT` from both ends of each token; drop empty tokens. `PUNCT` = ASCII punctuation ``!"#$%&'()*+,-./:;<=>?@[\]^_`{|}~`` plus `“”‘’…–—।॥`.
3. **Word features**: unigrams and bigrams over the tokens (bigrams joined with one space), each prefixed `w:`.
4. **Char features**: for each whitespace-separated word `w` in `t`, pad as `" " + w + " "` and emit character n-grams for n = 2..5 using scikit-learn's `char_wb` procedure exactly (including the rule that a word shorter than n yields one gram and stops), each prefixed `c:`.
5. Features from both steps go into one list.

In Python, pass this function as `analyzer=` to one `TfidfVectorizer(analyzer=akshi_analyzer, sublinear_tf=True, smooth_idf=True, norm='l2', min_df=2)`. One vectorizer means one L2 norm, which the TS side reproduces.

TypeScript notes: iterate code points (`Array.from(word)`) for n-grams, not UTF-16 units, to match Python string indexing. Record each gram's UTF-16 start offset in the original normalised string while iterating, for spans.

### 4.2 Training (`train.py`)

1. **Scam model**: `LogisticRegression(class_weight='balanced', solver='liblinear', max_iter=2000)`, `C` chosen from {0.5, 1, 2, 4, 8} by validation F1.
2. **Category model**: on scam rows only, `LogisticRegression(penalty='l1', solver='saga', max_iter=4000)` (multinomial), `C` from {0.5, 1, 2, 4} by validation macro-F1. L1 keeps the coefficient matrix sparse so the export stays small.
3. **Pruning**: keep the union of the top 18,000 features by |coefficient| in the scam model and the top 300 per class in the category model (cap 20,000 total). Refit the vectorizer with `vocabulary=` the kept features (recomputing IDF on train), then retrain both models on the restricted vocabulary. This keeps Python and TS mathematically identical.
4. Report validation metrics to stdout and `ml/out/train-report.json`. Never look at the test or handwritten splits while choosing anything.

### 4.3 Export format (`packages/model/model/scam-model.json`)

```json
{
  "format": "akshi-lr-v1",
  "version": "2026.11.16-a",
  "trainedAt": "2026-11-16T10:00:00Z",
  "featurizer": { "word": [1, 2], "char": [2, 5], "sublinearTf": true, "norm": "l2", "punct": "…" },
  "features": ["w:otp", "c: ot", "…"],
  "idf": [3.21, 2.87],
  "scam": { "coef": [0.84123, -0.10234], "intercept": -0.734 },
  "category": {
    "classes": ["fake_kyc", "upi_collect"],
    "coef": [[[12, 1.2034], [981, 0.8812]], [[44, 0.9921]]],
    "intercept": [-1.1, -0.9]
  },
  "metrics": { "valF1": 0.0, "valCategoryMacroF1": 0.0 }
}
```

- `idf` and `scam.coef` align with `features`. Category `coef` is sparse: per class, a list of `[featureIndex, value]`.
- Round floats to 5 decimal places. Target size ≤ 1.2 MB raw (check gzipped size and record it).
- `version` format `YYYY.MM.DD-<letter>`; bump on every export.

### 4.4 TypeScript inference (`packages/model/src`)

- `loadModel()`: `await import('../model/scam-model.json')` (Vite splits it into its own chunk; Node can import it too). Build a `Map<string, number>` from `features` once. Return `null` if the JSON is missing or `format` is unknown.
- `predict(text)`:
  1. Featurise (same steps as §4.1), counting occurrences per known feature and recording spans per occurrence.
  2. `tf = 1 + ln(count)`; `x_j = tf × idf_j`; L2-normalise over present known features.
  3. `pScam = sigmoid(Σ x_j × coef_j + intercept)`.
  4. Category logits from the sparse matrix; softmax; `category` = argmax if `pScam ≥ 0.4`, else `null`; `categoryProbs` for the top 5.
  5. `contributions`: `value = x_j × coef_j` for positive values, top 25, each with its spans (merge spans of the same feature that overlap).
- Performance: predict ≤ 10 ms for 2,000 characters on a laptop.

### 4.5 Parity test

`parity.py` writes `packages/model/test/parity-fixtures.json` with 200 validation texts (all languages, including emoji and romanised Hindi), their normalised form, Python `pScam`, and the category argmax. `packages/model/test/parity.test.ts` asserts the TS normalisation matches exactly, `|ΔpScam| < 1e-3`, and identical category argmax for every text.

### 4.6 Calibration (`packages/model/model/calibration.json`)

```json
{ "version": "2026.11.16-a", "thresholds": { "scam": 70, "suspicious": 40 },
  "fusion": { "rules": 0.45, "model": 0.35, "links": 0.20 }, "aiBlend": 0.2 }
```

`loadCalibration()` imports this synchronously and falls back to these defaults. In P4 you tune thresholds and fusion weights by running the engine over the **validation** split with a small grid (weights in steps of 0.05; thresholds 60–80 / 30–50 in steps of 5), maximising F1 subject to false-alarm rate on genuine bank messages ≤ 3%. Record the chosen values and why in `docs/eval-notes.md`.

---

## 5. Evaluation harness (`eval/`, package `@akshi/eval`)

- TypeScript, runs in Node with `tsx`: `npm run eval` (root) → `eval/src/run.ts`.
- Loads `data/messages/*.jsonl`, runs `analyze()` from `@akshi/engine` with `lang` = row language, `options.cloudAI: false`, network extras off (`expandLinks: false`, `domainAge: false`), and layer toggles per config:

| Config | Layers |
|---|---|
| `rules_only` | rules + local link/UPI checks; model off, indicators off |
| `rules_model` | as `rules_only` plus the model |
| `full_no_ai` | everything except AI (adds indicators) |
| `full_ai_sample` | everything, AI on, ≤ 100 test messages, run once (§5.1) |

- A message counts as predicted scam when the verdict is `scam` or `suspicious` (record both "scam-only" and "scam+suspicious" metrics in `notes`).
- Computes `Metrics` overall on the test split, on the handwritten split, per language, per category (recall), `fprGenuineBank` (rows tagged hard negatives with bank/OTP content), confusion matrix over verdicts × labels, and latency p50/p95 for `full_no_ai`.
- Statement detection: runs `analyzeStatement` on each sample statement and compares with its labels file (§6.5) → `statements` block.
- Writes `packages/content/src/eval-report.json` (validated with `EvalReportSchema`) and a readable `eval/out/report.md`.
- Before M1 the engine is a stub, so the numbers are meaningless; build and test the harness anyway. Real runs start in P4 after merging `main`.

### 5.1 AI sample run

Run once in P5 with your own free Groq and Gemini keys in a local `.env` (never committed), using `npm run dev:api` and the engine pointed at `http://localhost:3001`. Throttle to stay well under free-tier limits (for example one request every 4 seconds). Store only metrics, not responses.

---

## 6. Insights (`packages/insights`)

### 6.1 CSV formats

| Format | Header | Notes |
|---|---|---|
| `canonical` | `date,time,description,debit,credit,balance,channel,counterparty,upi_id` | Our format; samples use it. Date `YYYY-MM-DD` or `DD/MM/YYYY`; time `HH:MM` 24h |
| `bank_a` | `Txn Date,Value Date,Description,Ref No./Cheque No.,Debit,Credit,Balance` | Common Indian bank export layout; no time (`hasTime: false`) |
| `bank_b` | `Date,Narration,Amount,Dr/Cr,Balance` | Single amount column with `Dr`/`Cr` |

Detect the format from the header (case and whitespace insensitive). Parse Indian number formats (`1,00,000.00`). From UPI narrations like `UPI/DR/412345678901/RAVI K/YESB/ravik123@ybl/Payment` extract direction, counterparty and UPI ID; otherwise use the description as counterparty. Report bad rows in `errors` with row numbers; never throw on bad input.

### 6.2 Categoriser

Keyword map from description/counterparty to `SpendCategory` (Swiggy, Zomato → food; BigBasket, Blinkit, Zepto, DMart → groceries; Amazon, Flipkart, Myntra → shopping; Uber, Ola, Rapido, IRCTC, metro → transport; electricity, Jio, Airtel, broadband, gas → bills; rent; school, college, fees → education; pharmacy, hospital → health; Netflix, BookMyShow → entertainment; SALARY → salary; ATM → cash; SIP, mutual fund, Zerodha, Groww → investment; EMI, loan → emi; person-to-person UPI → transfers; else other).

### 6.3 Baseline

Over debits: median, p90, usual hours (10th–90th percentile of debit hour, only when `hasTime`), frequent payees (≥ 3 debits).

### 6.4 Anomalies

Rule anomalies (P0):

| Type | Rule | Severity |
|---|---|---|
| `large_new_payee` | First-ever debit to a counterparty and amount ≥ max(5 × median, ₹5,000) | high if ≥ 10 × median, else medium |
| `burst_small_debits` | ≥ 3 debits ≤ ₹500 to the same new payee within 30 min, or ≥ 5 debits of any size within 10 min | high |
| `odd_hour` | Debit between 00:00 and 05:00, amount ≥ 2 × median, outside usual hours | medium (high if also new payee) |
| `duplicate` | Same amount and counterparty within 10 min | low |
| `credit_then_return` | Credit from an unknown sender, then within 48 h a debit within ±5% of that amount (wrong-transfer pattern) | high |
| `round_amount_new_payee` | Round amount ≥ ₹10,000 (multiple of 1,000) to a new payee | medium |
| `velocity` | Debits in any rolling 60 min ≥ 4 × the median daily debit total | medium |

Isolation Forest (P1, M5.4), implemented in TypeScript:

- Features per debit: `log10(amount)`, `sin`/`cos` of hour (omit when no time), new-payee flag, days since last debit to the same payee (capped 90; new payee = 90), count of debits in the previous hour, round-amount flag, UPI flag.
- 100 trees, subsample ψ = min(256, n), height limit ⌈log₂ ψ⌉, score `s(x) = 2^(−E[h(x)] / c(ψ))` with `c(n) = 2H(n−1) − 2(n−1)/n`, `H(i) = ln(i) + 0.5772156649`. Seeded PRNG (mulberry32, seed 42) for repeatable results.
- Flag `isolation_outlier` when score ≥ 0.62 and in the top 5% of debits, unless a rule anomaly already covers the transaction.
- "Why unusual": compare the transaction's features with the baseline and list the top three deviations as `features` rows (e.g. `Amount · ₹48,000 · usual ₹650`).
- Validation: `iforest_check.py` fits scikit-learn `IsolationForest` on the same features for each sample statement; the TS scores must have Spearman correlation ≥ 0.8 with scikit-learn's. Record results in `docs/eval-notes.md`.

Statement `riskScore`: 0 with no anomalies; otherwise 40 + 20 per high anomaly + 10 per medium + 3 per low, capped at 100. `narrative` (M5.6): a two- or three-sentence localised summary from templates ("Most of your spending is on food and transfers. Two payments stand out: …").

### 6.5 Sample statements

`statements.py` generates three 90-day canonical CSVs with fake names and UPI IDs, plus labels:

| ID | Persona | Rows | Injected scenarios |
|---|---|---|---|
| `student` | College student, small UPI spends | ~150 | burst of 4 × ₹499 "task" payments to a new payee; ₹1 credit then ₹9,999 debit to a new payee at 23:40 |
| `salaried` | Salaried professional | ~250 | ₹48,000 to a new payee at 02:47; duplicate ₹1,299 charge |
| `shop` | Small shop owner, many credits | ~400 | ₹5,000 credit from an unknown sender then ₹5,000 debit within 3 h; round ₹20,000 to a new payee |

Each has `data/statements/<id>.csv` and `data/statements/<id>.labels.json` (`[{ "txnIds": [...], "type": "…" }]`). Copy the CSVs into `SAMPLE_STATEMENTS` with localised titles.

### 6.6 Entity graph (`buildEntityGraph`)

- Nodes from each scan's `entities`: UPI IDs, phones, domains (registrable domain). `mine: true` for nodes from history.
- With `includeBundled`, add `INDICATORS` and a `campaign` node per distinct `campaign`, linked by `part_of`.
- `appears_with` edges between entities from the same scan.
- Merge duplicate values (normalised). `risk` = max risk seen for that entity. Stats: connected components and the largest component size.

---

## 7. Content (`packages/content`)

All content files are TypeScript modules exporting typed constants validated by zod tests. Strings use `L10n`.

| Export | Requirement |
|---|---|
| `SAMPLE_MESSAGES` | 12 items: fake KYC (en), collect-request refund (en), electricity disconnection (hi), digital arrest (hi, romanised), part-time job (te), courier customs (bn), lookalike link (en), wedding APK (bn), wrong transfer (te), genuine bank OTP (en, `genuine: true`), genuine debit alert (hi, `genuine: true`), genuine delivery update (en, `genuine: true`). Taken from the test split or written fresh, never from train. |
| `INDICATORS` | ≈150 entries derived from the synthetic dataset's scam UPI IDs, phones and domains, grouped into 8–12 named campaigns; all `sampleData: true`. |
| `LANDSCAPE` | Counts from the dataset by category, language and channel; `sampleData: true`. |
| `FAQ` | ≥ 30 items, en + hi + te required, bn where possible. Topics: QR codes and receiving money; PIN only sends money; collect requests; banks never ask for OTP/PIN; `.bank.in` and official domains; digital arrest (no such procedure by phone or video call); APK files; screen-sharing apps; refunds; customer-care numbers from search results; job tasks that ask for payment; guaranteed returns; wrong-transfer requests; what to do after sharing an OTP; how to report (1930, cybercrime.gov.in, Chakshu for attempts); how Akshi Rakshak works and what it stores. |
| `EMERGENCY` | Six questions (SPEC.md §6.4). Steps: `always` → call 1930 or report at cybercrime.gov.in if money left the account; `sent_money` → call your bank's official helpline, note the transaction ID/UTR, report quickly; `entered_pin` → change UPI PIN from your bank or UPI app, check for debits; `shared_otp` → call the bank, change passwords; `installed_app` → switch on airplane mode, uninstall the app, remove its Accessibility and "display over other apps" permissions, then call the bank; `gave_remote_access` → end the session, uninstall the remote-access app, call the bank; `shared_card` → block the card through the bank's official app or helpline; `no_loss` → report the number or message on Chakshu (Sanchar Saathi), which handles suspected fraud communication, not completed fraud. Evidence checklist: screenshots, numbers, UPI IDs, links, transaction IDs, dates and times. Keep instructions general; do not invent bank-specific procedures. |
| `DRILLS` | 10 drills (≥ 6 by M1). Each has 5–9 nodes, at least one path that ends `safe` and one that ends `scammed`, 2–3 choices per decision node, feedback on every choice, `redFlag` on the key moments. Scenarios: fake KYC SMS; collect request "refund"; marketplace buyer with QR "to pay you"; electricity disconnection tonight; digital arrest video call; part-time like-and-earn task job; stock-tips group with guaranteed returns; "sent by mistake, please return"; wedding invitation APK; fake customer care asking for a screen-sharing app. Languages: en, hi, te for all; bn for at least four (P2). |
| `PATTERN_CARDS` | 8 cards describing how each major scam works and the tell-tale signs. No statistics unless with a `sourceUrl` you actually opened. |
| `EVAL_REPORT` | Imported from `src/eval-report.json` written by the eval harness. |

---

## 8. Documents you own

### 8.1 `docs/eval-notes.md`

Training runs (version, C values, validation metrics, export size), calibration choices, error analysis (20 false positives and 20 false negatives from validation with the reason and the fix), Isolation Forest validation, final test and handwritten results with honest commentary.

### 8.2 `docs/i18n-review.md`

A checklist of every localised file across the repo (engine strings, web locales, content), grouped by language, with a column for the reviewer's name and status. Includes guidance for reviewers: plain everyday words, correct script, warnings that make sense to an older reader, no literal translations that change meaning. Reviewers send corrections to the owning laptop.

### 8.3 `README.md` (judge-facing; P5)

Sections: name and tagline; live link; demo video link; what it does (≤ 80 words); screenshots (landing, analysis, collect explainer, Elder STOP, Proof); how it works (architecture diagram as text or Mermaid); the AI and ML (layers, model, OCR, anomaly detection, LLM second opinion, measured results with a link to `/proof`); privacy and offline; languages; run locally (`npm install`, `npm run dev`, optional `.env`); deploy (Vercel); project structure; dataset statement (synthetic + handwritten, how built, limits); credits — every open-source library and every AI API (Groq, Google Gemini, tesseract.js and its traineddata, scikit-learn, three.js, Motion, Recharts, shadcn/ui and Radix, Fontsource fonts, Vercel AI SDK, and the rest from the lockfiles); team; licence (MIT). Hackathon rules ask for a README that explains what the app does and how to run it, and for credit to libraries and AI APIs.

### 8.4 `docs/demo-script.md` (P6)

Full narration and shot list for the timeline in SPEC.md §13.1, with exact sample inputs, which screen to record on (phone vs laptop), who records which part, and a backup plan if the AI provider is rate-limited during recording (show the offline path instead).

---

## 9. Quality checks

- `pytest` covers normalisation, featuriser, splits (no family leakage), generator validation.
- Vitest covers parity, model loading failure (`null`), statement parser formats and bad rows, each anomaly rule, Isolation Forest determinism, graph builder, content schemas, and that every `SAMPLE_MESSAGES` item gets its `expected` verdict from the real engine after M1.
- Never tune anything on `test` or `handwritten`. If you look at them, note it in `eval-notes.md`.
- Report results as they are. If handwritten recall is lower than the synthetic test, say so on the Proof page notes; that honesty is part of the pitch.
