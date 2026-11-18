# Evaluation notes

Kept by Laptop C. Numbers here are measured, not estimated. Nothing in this file was chosen by looking at the test or handwritten splits; when that changes, it will be said here.

**What was looked at on the test split (Phase 4).** After the final test run, the test numbers were split by "families that existed at Merge 1" versus "families added in Phase 4", and by language and hard-negative flag (`eval/src/compare-subsets.ts`; numbers only, no message text). Family names per split were read from `data/messages/splits.json`. This was done to explain why the test numbers moved, after every choice had been made; nothing was changed because of it.

## Training runs

### 2026.11.18-a (Phase 4, retrain with more Hindi, Telugu and Bengali)

Data: 76 new template families added; every earlier row, its text and its split are unchanged (checked row by row). 3,579 rows: 2,504 train (1,244 scam), 548 validation (248 scam), 527 test. New families: a second family for every scam category in Telugu and Bengali; a second Devanagari or romanised family in Hindi for the eight weakest categories (investment, task jobs, OTP theft, romance, QR, loan apps, wrong transfer, digital arrest); one English "guaranteed daily returns" family (A's lead b); and genuine hard negatives in te/bn/hi (bank fraud-awareness notices, FD/SIP/loan offers, credits, card alerts, EMIs, refunds, telecom, family chats) plus an English family of genuine investment adverts ("subject to market risks", "past returns do not guarantee"). Bare URLs, UPI IDs, phone numbers and QR payloads were not added (A's lead d).

| | 2026.11.16-a | 2026.11.18-a |
|---|---:|---:|
| Scam C (validation F1 grid 0.948 / 0.955 / **0.963** / 0.961 / 0.961 for C = 0.5 / 1 / 2 / 4 / 8) | 4 | **2** |
| Category C (macro-F1 0.105 / 0.282 / 0.556 / 0.604 / 0.617 / 0.628 / **0.644** for C = 0.5 … 32) | 16 | **32** |
| Validation F1, model alone at 0.5 | 0.955 (434 rows) | **0.963** (548 rows) |
| Validation false-alarm rate, model alone | 7.7% | 5.3% |
| Category macro-F1 / accuracy | 0.535 / 0.542 | **0.650 / 0.637** |
| Category accuracy en / hi / te / bn | 0.67 / 0.52 / 0.44 / 0.33 | 0.67 / 0.67 / 0.55 / 0.61 |
| Features after pruning | 18,312 | 18,793 |
| Export, raw / gzip | 565 KB / 122 KB | 598 KB / 133 KB |

The validation split grew (new families were assigned by the same family-level stratified split), so the two validation columns are not the same messages. The category C is again at the top of the grid; it was left there because the gain from 16 to 32 is small and the model size grows with C. The saga iteration limit was raised from 4,000 to 12,000, and every grid point now converges. Parity: 200 validation texts, identical normalisation, |ΔpScam| < 1e-3 and the same category for all 200.

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

**Shipped: rules 0.30 / model 0.35 / links 0.35, thresholds 70 / 40, AI blend 0.2** (chosen in Phase 4, merged into `feat/data` in Phase 5 once A's two engine tests read the calibration in use instead of the defaults). The values pass the engine's own check (0 < 40 < 70 < 100, weights in [0, 1], rules > 0, blend in [0, 1]); `packages/model/test/model.test.ts` checks the same rules against the file.

**Phase 5 check, nothing changed.** After A's rule fixes (which came from the validation error list), the search was rerun read-only: validation is now saturated (F1 99.6%, 0 of 160 bank false alarms with the shipped values; several other points tie). Validation can no longer tell settings apart and is optimistic for these rules, so the Phase 4 values were kept and frozen before the final test run.

**Method** (`npm run calibrate -w @akshi/eval`, validation only). `analyze()` runs once per validation message with the full system and no AI. Every result reports each layer's own score, so the §8.2 fusion is recomputed offline for each grid point; the recomputation reproduces the engine's score on all 548 messages before the search starts (the rules score is recovered unrounded from its share). Grid: weights in steps of 0.05 summing to 1 (only ratios matter), suspicious 30–50, scam 60–80 in steps of 5: 1,050 points.

**Constraint and guard.** Objective: highest F1 (scam or suspicious = flagged) with false alarms on genuine bank, OTP and UPI messages ≤ 3%. One guard was added: suspicious ≤ 45, because the engine has 45-point floors (ASKS_OTP, TOO_GOOD_RETURNS: "a message that asks for an OTP must never read No warning signs found"), and a threshold of 50 would quietly switch those off. Among the points within 0.005 F1 of the best, the one that leans least on the model is taken, because validation comes from the same generator as training and the model's share is what is most likely to be overfitted.

| Point | Rules / model / links | Suspicious | Val F1 | Val bank false alarms |
|---|---|---:|---:|---:|
| Spec defaults | 0.45 / 0.35 / 0.20 | 40 | 0.922 | 5.0% (8 of 160) |
| **Chosen** | **0.30 / 0.35 / 0.35** | **40** | **0.976** | **3.75% (6 of 160)** |
| Best F1 with suspicious ≤ 45 | 0.25 / 0.50 / 0.25 | 45 | 0.980 | 3.75% |
| Also rules ≥ model | 0.40 / 0.40 / 0.20 | 45 | 0.921 | 3.75% |
| No guard (rejected) | 0.15 / 0.50 / 0.35 | 50 | 0.984 | 0.6% |

**The 3% limit is not met.** No point with suspicious ≤ 45 gets below 3.75%: the remaining 6 bank false alarms are the Telugu bank advisories in `bankinfo-te-01`, where ASKS_PIN or ASKS_CVV_PASSWORD fire on a sentence that says the bank will *never* ask for them (rules score 55–59 on its own). Only a threshold of 50 hides them, and that breaks the floors above. The fix belongs in the rules (list for A below), not in the weights.

**Scam threshold** stays at 70: it does not change flagged/not flagged, no genuine validation message scores above 50 under the chosen weights, and the word "scam" should stay conservative on real messages. AI blend is unchanged (it needs the AI sample run, Phase 5).

**Effect, confirmed with the real engine** (`npm run eval -w @akshi/eval -- --split val`, full system, no AI): F1 92.2% → **97.6%**, recall 88.3% → 98.0%, precision 96.5% → 97.2%, false negatives 29 → 5, false positives 8 → 7.

## Isolation Forest validation (Phase 3)

`ml/akshi_ml/iforest_check.py` computes the per-debit features independently in Python and scores them with `sklearn.ensemble.IsolationForest` (100 trees, `max_samples = min(256, n)`, `random_state=42`). The TypeScript test checks that both sides build identical feature rows, then compares the scores:

| Statement | Debits | Spearman (TS vs scikit-learn) |
|---|---:|---:|
| salaried | 172 | 0.978 |
| student | 142 | 0.985 |
| shop | 71 | 0.975 |

All three are above the 0.8 target. The two forests use different random streams, so the scores are not identical; the ranking is what matters for "top 5%".

## Statement detection (Phase 3)

| Statement | Transactions | Planted | Flagged | Expected type | Other flags |
|---|---:|---:|---:|---:|---:|
| salaried | 177 | 2 | 2 | 2 | 0 |
| student | 150 | 2 | 2 | 2 | 0 |
| shop | 390 | 2 | 2 | 1 | 0 |

The shop's round ₹20,000 payment is reported as `large_new_payee` (it is also more than 5 × the median), not `round_amount_new_payee`, because one card is shown per payment and the larger rule wins. Before two filters were added (regular payees are not "new"; a forest outlier must also be unusual for its payee), the forest added 7 cards on salaried, 5 on student and 2 on shop, all ordinary payments such as EMI, SIP, rent and staff salary. These figures come from the same samples the rules were written against, so they show the rules work, not how they perform on real statements.

## Message evaluation (real engine)

Engine 0.3.0 from `feat/engine` (A's PR #2, merged into `feat/data` because it was not on `main` yet), full system without AI unless stated. Flagged = verdict scam or suspicious.

**Test split at the end of Phase 4** (model 2026.11.18-a, default calibration, 527 messages; superseded by "Final results" below):

| Configuration | Precision | Recall | F1 | False-alarm rate |
|---|---:|---:|---:|---:|
| rules_only | 86.2% | 50.6% | 63.8% | 7.1% |
| rules_model | 90.7% | 79.3% | 84.7% | 7.1% |
| full_no_ai | 91.6% | 88.3% | 89.9% | 7.1% |

By language: en F1 94.0%, hi 93.4%, te 85.0% (precision 77.3%), bn 83.1%. False alarms on genuine bank messages 14.3% of 140. Only the "scam" verdict counted: precision 91.5%. Latency p50 0.15 ms, p95 0.93 ms. Statements: 6 of 6 planted scenarios, 0 false flags.

**Why the test numbers dropped from A's rehearsal (F1 92.9%, 2.3% false alarms).** The test split grew from 433 to 527 messages because six Phase 4 families were assigned to it. On the original 433 messages the numbers are exactly A's rehearsal: precision 97.4%, recall 88.7%, F1 92.9%, false alarms 2.3% (bn F1 81.4%, every false alarm Bengali, 25% of Bengali bank messages). The 94 new messages have 25% false alarms, all from one Telugu genuine family (`bankinfo-te-02`, fraud-awareness notices, 15 of 20 flagged). That is the same pattern as `bankinfo-te-01` in validation (rules firing on "the bank never asks for your PIN"), so the drop is the rules' negation gap meeting new data, not the retrain.

**With the tuned calibration** (the draft PR; same test messages, reported, not chosen): F1 89.9% → **93.4%**, recall 88.3% → 94.7%, false alarms 7.1% (unchanged), bank false alarms 12.9%. On the original 433: F1 92.9% → 95.7%, false alarms 2.3% → 3.2%.

**Validation, for comparison** (548 messages): default calibration F1 92.2%, false alarms 2.7%, bank 5.0%; tuned F1 97.6%, false alarms 2.3%, bank 3.75%. Before the retrain (model 2026.11.16-a, the old 434-message validation split): F1 91.4%, false alarms 3.6%, bank 10.0%.

The handwritten set has not arrived yet; `python -m akshi_ml.handwritten` converts it, and `npm run eval` adds it to the report.

## Error analysis (validation only)

Two passes with `npm run errors -w @akshi/eval` (full system, no AI, default calibration). Pass 1: model 2026.11.16-a, 434 messages, 8 false positives and 27 false negatives. Pass 2: model 2026.11.18-a, 548 messages, 8 false positives and 29 false negatives. Below, the 8 false positives and 20 false negatives of pass 2 (pass 1 had the same false positives and the same kinds of false negatives).

**False positives (8 of 8)** — all `bankinfo-te-01`, Telugu genuine bank advisories:

| # | Text (shortened) | Rules | Model | Why | Fix belongs in |
|---|---|---:|---:|---|---|
| 1–6 | "సురక్షిత బ్యాంకింగ్: డబ్బు అందుకోవడానికి క్యూఆర్ కోడ్ స్కాన్ చేయడం లేదా యూపీఐ పిన్ ఎంటర్ చేయడం అవసరం లేదు…" ("receiving money does *not* need a QR scan or a UPI PIN"), six banks | 55 (ASKS_PIN) | 39–45 | ASKS_PIN matches "యూపీఐ పిన్ ఎంటర్ చేయడం" and ignores the following "అవసరం లేదు" (not needed) | engine rules (negation) |
| 7–8 | "… ఎప్పుడూ … మీ ఓటీపీ, పిన్ లేదా పాస్‌వర్డ్ అడగదు. వాటిని ఎవరికీ చెప్పకండి." ("the bank never asks for your OTP, PIN or password; don't tell anyone") | 59 (ASKS_CVV_PASSWORD + SECRECY) | 19–21 | ASKS_CVV_PASSWORD ignores "అడగదు" (does not ask); SECRECY reads "don't tell anyone" as a scammer's demand rather than advice | engine rules (negation; SAFETY_ADVICE in Telugu) |

The retrain pulled the model down on these (57 → 40 on rows 1–6) by adding Telugu fraud-awareness notices to training; the rules alone keep them flagged.

**False negatives (20 of 29)** — the model is confident (60–89) but no rule fires, so the fused score stays under 40 with the default weights:

| # | Family | Lang | Text (shortened) | Rules | Model | Missing signal | Fix belongs in |
|---|---|---|---|---:|---:|---|---|
| 1–2 | otps-en-01 | en | "I entered your number by mistake while registering. A 6 digit code has come to your phone, please send it to me quickly." | 0 | 74 | ASKS_OTP ("send … code") | engine lexicon |
| 3–6 | otps-en-01 | en | "IndusInd Bank verification: An OTP has been sent to you. Reply to this message with the OTP today to confirm your identity…" | 0–15 | 62–70 | ASKS_OTP ("reply … with the OTP") | engine lexicon |
| 7–8 | qr-en-01 | en | "To receive the advance of Rs.8,000, please scan this QR and approve. Do not worry, the money will come to you…" | 0 | 60–67 | QR_TO_RECEIVE ("to receive … scan this QR") | engine lexicon |
| 9 | qr-en-01 | en | "Madam your refund QR is generated. Open any UPI app, scan and confirm with P.I.N to credit Rs 22,000…" | 15 | 62 | QR_TO_RECEIVE / RECEIVE_WITH_PIN ("P.I.N" spaced; only OBFUSCATION fired) | engine lexicon |
| 10–12 | job-en-02 | en | "Mentor: You made a mistake in the last order so your funds are frozen. To repair the order and withdraw everything you must recharge ₹7,700…" | 0 | 72–80 | TASK_JOB_PAYMENT ("recharge … to withdraw", "funds are frozen") | engine lexicon |
| 13–14 | job-en-02 | en | "Receptionist …: Your daily salary is ready. To withdraw you need to finish the combo task. Send Rs.1,700 to daily.task.reward@ibl…" | 0 | 79–81 | TASK_JOB_PAYMENT ("combo task", "send … to withdraw"); the UPI ID before a full stop is not extracted, so its indicator match is lost | engine UPI extraction / lexicon |
| 15–17 | romance-hid-01 | hi | "मैं दिल्ली हवाई अड्डे पर फंस गया हूं, कस्टम वाले छोड़ नहीं रहे। कृपया ₹4,05,000 भेज दो…" | 0 | 83–85 | no romance/emergency-money signal in Hindi ("stuck at the airport, customs", "send money, I'll return it") | engine lexicon (new) |
| 18 | wrong-hir-01 | hi (Latin) | "Bhaiya ek digit galat type ho gaya aur INR 15,500 aapko chala gaya. Maine request bheji h, usko accept karke PIN daal do bas." | 0 | 88 | WRONG_TRANSFER_RETURN and RECEIVE_WITH_PIN in Hinglish ("request accept karke PIN daal do") | engine lexicon |
| 19 | loan-bn-01 | bn | "আপনার লোন বকেয়া আছে। ২ ঘণ্টার মধ্যে টাকা 1,62,500 না দিলে আপনার ছবি আপনার সব কন্টাক্টে পাঠিয়ে দেওয়া হবে।" | 0 | 89 | loan-harassment threat in Bengali ("your photos to all contacts") | engine lexicon |
| 20 | arrest-te-01 | te | "ఇది రహస్య కేసు. మీ కుటుంబానికి గానీ బ్యాంకుకు గానీ చెప్పకూడదు. కెమెరా ఆన్‌లో ఉంచండి… పోలీసులు మీ ఇంటికి వస్తారు." | 15 | 66 | SECRECY ("చెప్పకూడదు"), STAY_ON_CALL ("కెమెరా ఆన్‌లో ఉంచండి"), THREAT_LEGAL in Telugu; only AUTHORITY_CLAIM fired | engine lexicon |

The other 9: five more `invest-te-02` (Telugu "profit … pay 20% service charge before withdrawal", "IPO quota … three times assured": TOO_GOOD_RETURNS and ADVANCE_FEE do not fire in Telugu), three more `job-en-02`, one `job-bn-02` (Bengali "funds frozen … recharge to withdraw").

**Where the fixes went.**
- Dataset (done in Phase 4): Telugu, Bengali and Hindi hard negatives, including fraud-awareness notices that use the scam words; a second scam family per category in te/bn and in Hindi for the weak categories; an English "guaranteed daily returns" family. Result: model-alone validation false alarms 7.7% → 5.3%, and the model now scores every false-negative row above 57.
- Model and calibration (done, tuned values in the draft PR): give the model's confident score enough weight to flag a message when no rule fires (29 → 5 false negatives on validation).
- Engine rules and lexicons (A): the list below.

## For A: validation errors caused by rules, lexicons or link/UPI checks

Each line: text (validation), expected, got (default calibration), signal. Full rows with every layer's score: `npm run errors -w @akshi/eval` → `eval/out/errors-val.json`.

**False positives (rules fire on genuine text)**
1. "సురక్షిత బ్యాంకింగ్: డబ్బు అందుకోవడానికి క్యూఆర్ కోడ్ స్కాన్ చేయడం లేదా యూపీఐ పిన్ ఎంటర్ చేయడం అవసరం లేదు. జాగ్రత్తగా ఉండండి. -కెనరా బ్యాంక్" — expected genuine, got suspicious 48 — **ASKS_PIN** (0.55) fires despite "అవసరం లేదు" (not needed). Six rows, six banks.
2. "హెచ్‌డీఎఫ్‌సీ బ్యాంక్ ఎప్పుడూ ఫోన్, ఎస్ఎంఎస్ లేదా ఈమెయిల్ ద్వారా మీ ఓటీపీ, పిన్ లేదా పాస్‌వర్డ్ అడగదు. వాటిని ఎవరికీ చెప్పకండి. మోసాలపై 1930 కు ఫిర్యాదు చేయండి." — expected genuine, got suspicious 41 — **ASKS_CVV_PASSWORD** (0.45) despite "అడగదు" (does not ask), plus **SECRECY** (0.25) on "ఎవరికీ చెప్పకండి" in advice. Two rows. SAFETY_ADVICE did not fire in Telugu.
3. Test split (reported only; text not inspected): `bankinfo-te-02`, the same kind of Telugu notice, 15 of 20 flagged; Bengali genuine bank messages in the original test families, 5 of 20 flagged.

**False negatives (no rule fires on a clear scam)**
4. "Hi, I entered your number by mistake while registering. A 6 digit code has come to your phone, please send it to me quickly." — expected otp_theft, got no_signs 32 — **ASKS_OTP** missing for "send (me) the code / 6 digit code".
5. "IndusInd Bank verification: An OTP has been sent to you. Reply to this message with the OTP today to confirm your identity and avoid account blocking." — expected otp_theft, got no_signs 28 — **ASKS_OTP** missing for "reply … with the OTP"; **THREAT_BLOCK** missing for "avoid account blocking".
6. "To receive the advance of Rs.8,000, please scan this QR and approve. Do not worry, the money will come to you, scanning is only for confirmation." — expected qr_receive, got no_signs 29 — **QR_TO_RECEIVE** missing ("to receive … scan this QR").
7. "Madam your refund QR is generated. Open any UPI app, scan and confirm with P.I.N to credit Rs 22,000." — expected qr_receive, got no_signs 36 — **QR_TO_RECEIVE / RECEIVE_WITH_PIN**; only OBFUSCATION fired (the spaced "P.I.N" is not read as PIN).
8. "Mentor: You made a mistake in the last order so your funds are frozen. To repair the order and withdraw everything you must recharge ₹ 7,700 before 6 PM today." — expected job_task, got no_signs 32 — **TASK_JOB_PAYMENT / ADVANCE_FEE** missing ("recharge … to withdraw"), **URGENCY** missing ("before 6 PM today").
9. "Receptionist Pooja Gupta: Your daily salary is ready. To withdraw you need to finish the combo task. Send Rs.1,700 to daily.task.reward@ibl." — expected job_task, got no_signs 35 — **UPI extraction bug**: a UPI ID followed by a full stop ("…to daily.task.reward@ibl. All members…") is not extracted at all (no UPI entity, UPI layer unavailable). Without the full stop ("Send Rs.1,700 to daily.task.reward@ibl now") it is extracted, matches the bundled indicator and the message scores 95. In validation, 6 of the 38 scams that contain a UPI ID have it right before a full stop or danda. Also **TASK_JOB_PAYMENT** missing ("combo task").
10. "Bhaiya ek digit galat type ho gaya aur INR 15,500 aapko chala gaya. Maine request bheji h, usko accept karke PIN daal do bas." — expected wrong_transfer, got no_signs 38 — **WRONG_TRANSFER_RETURN** and **RECEIVE_WITH_PIN** missing in Hinglish ("galat … chala gaya", "accept karke PIN daal do").
11. "मैं दिल्ली हवाई अड्डे पर फंस गया हूं, कस्टम वाले छोड़ नहीं रहे। कृपया ₹4,05,000 भेज दो, मिलते ही वापस कर दूंगा।" — expected romance, got no_signs 36 — no signal for "stranded abroad / customs holding me, send money, I'll return it" in Hindi (romance has no rule).
12. "আপনার লোন বকেয়া আছে। ২ ঘণ্টার মধ্যে টাকা 1,62,500 না দিলে আপনার ছবি আপনার সব কন্টাক্টে পাঠিয়ে দেওয়া হবে।" — expected loan_app, got no_signs 39 — no threat signal for "your photos will be sent to all your contacts" (Bengali); **URGENCY** missing for "২ ঘণ্টার মধ্যে".
13. "ఇది రహస్య కేసు. మీ కుటుంబానికి గానీ బ్యాంకుకు గానీ చెప్పకూడదు. కెమెరా ఆన్‌లో ఉంచండి, గది బయటకు వెళ్లకండి. కాల్ కట్ చేస్తే ఈరోజు పోలీసులు మీ ఇంటికి వస్తారు." — expected digital_arrest, got no_signs 37 — **SECRECY** ("చెప్పకూడదు"), **STAY_ON_CALL** ("కెమెరా ఆన్‌లో ఉంచండి"), **THREAT_LEGAL** ("పోలీసులు మీ ఇంటికి వస్తారు") missing in Telugu.
14. "మీ ఖాతాలో లాభం ₹54,000 చేరింది. విత్‌డ్రా చేయడానికి ముందుగా ఇరవై శాతం సర్వీస్ ఛార్జ్ కట్టాలి. ఆలస్యం చేస్తే ఖాతా ఫ్రీజ్ అవుతుంది." — expected investment_crypto, got no_signs 37 — **ADVANCE_FEE** ("pay a charge before withdrawal") and **THREAT_BLOCK** ("account will freeze") missing in Telugu.
15. "ఐపీఓ ఇన్‌స్టిట్యూషనల్ కోటా సీట్లు కొన్ని మాత్రమే మిగిలాయి. ఈరోజు ₹1,48,000 పెట్టుబడి పెడితే లిస్టింగ్ రోజున మూడు రెట్లు ఖాయం. ఎవరికీ చెప్పకండి." — expected investment_crypto, got no_signs 39 — **TOO_GOOD_RETURNS** missing in Telugu ("మూడు రెట్లు ఖాయం", three times assured); SECRECY fired.
16. "মেন্টর: শেষ টাস্কে আপনি ভুল করেছেন, তাই আপনার ফান্ড আটকে গেছে। তুলতে হলে আজ 600 টাকা রিচার্জ করুন।" — expected job_task, got no_signs 38 — **TASK_JOB_PAYMENT / ADVANCE_FEE** missing in Bengali.

## Final results (Phase 5)

Frozen before this run: model 2026.11.18-a, calibration above, engine 0.3.0 with A's Phase 4 fixes (`feat/engine` at 531e580). Nothing was tuned after it. Full system, no AI, held-out test split of the synthetic dataset (527 messages; 247 scams):

| Configuration | Precision | Recall | F1 | False alarms |
|---|---:|---:|---:|---:|
| rules_only | 95.3% | 49.8% | 65.4% | 2.1% |
| rules_model | 96.4% | 85.4% | 90.6% | 2.9% |
| **full_no_ai** | **96.7%** | **94.7%** | **95.7%** | **2.9%** |

| Language | Precision | Recall | F1 | n |
|---|---:|---:|---:|---:|
| en | 98.8% | 94.3% | 96.5% | 168 |
| hi | 100.0% | 90.8% | 95.2% | 145 |
| te | 88.1% | 96.3% | 92.0% | 114 |
| bn | 100.0% | 100.0% | 100.0% | 100 |

- **Genuine bank, OTP and UPI messages flagged: 4.3% (6 of 140)**, above the 3% target. All 8 test false alarms are "suspicious"; no genuine message got the "scam" verdict (scam-only precision 100%, recall 50.6%).
- Scam category named correctly for 68.4% of flagged scams. Latency p50 0.15 ms, p95 0.94 ms. Statements: 6 of 6 planted scenarios, 0 false flags.
- Weak spots: **romance 3 of 9** (Hindi "stranded abroad, send money" has no rule; adding a signal is a contract change during the freeze), **phishing_link 10 of 15**, and **Telugu precision 88.1%**.
- How F1 got here on the 527-message test split: 89.9% (model 2026.11.18-a, default calibration) → 93.4% (tuned calibration) → **95.7%** (A's rule fixes). On the 433 messages of the Merge 1 rehearsal it was 92.9% at Merge 1. The rule fixes were made from validation examples only; A read no test messages.
- **Not yet measured:** the handwritten set (the team's CSVs have not arrived) and the AI second opinion (no keys in a local `.env`). Both run with exactly these settings when available; no tuning follows.

**Honest commentary.** The test split shares the generator with training: its families are unseen patterns but written by the same author with the same fillers and variants, so these numbers are an upper bound for real messages. Bengali went from the weakest language at Merge 1 (F1 81.4%) to 100%, mostly from A's negation fix; it has only 100 test messages. The handwritten set is the real check, and if its recall is lower, the Proof page will say so.
