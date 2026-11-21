# Progress — engine

## Production

- **2026-11-21: `main` at a3c96ee (PR #9: the redesign, the Ask crash fix, dashboard sample data) is deployed.**
  - **Smoke check:** 9 pass, 1 warning (`/api/reports`: Upstash not connected), 0 fail. AI analyze is answered by Groq in 1.2 s (the PR #8 fix).
  - **Live UI checked in Edge:** the new landing (headline, 19-card deck, theme set), Ask opens and closes without crashing, and the dashboard shows the sample banner and entries. No page errors.
- **URL: https://akshi-rakshak.vercel.app** (first deployed from `main` at 7ce77ad, 2026-11-18, after PR #6).
- **Smoke check** (`npm run smoke -- https://akshi-rakshak.vercel.app`): 8 pass, 1 warning, 0 fail.
  - **Pass:** app shell and service worker, security headers, health (groq true, gemini true), expand (2 hops), the SSRF refusal (`blocked_private_address`), domain age, AI analyze, ask.
  - **Warning:** `/api/reports` is not configured, because the Upstash integration is not connected yet.
  - **To check:** AI analyze answered from **Gemini**, the fallback. Groq is first, so Groq may have failed or timed out on that call. Look at the `ai/analyze` provider logs in Vercel.
- Phone checks (§16 step 3): not done yet.
- **2026-11-18: the first `main` deploy (87829c7, after Merge 2) failed in the function build.** The web app built. Vercel's Node builder then forced `module: NodeNext` and `strict: false` on `api/` (it ignores options inherited through `extends`) and crashed with "Cannot read properties of undefined (reading 'text')". After that was fixed, the functions would still have failed at runtime, because Node cannot load our workspace packages (`.ts` exports, extensionless imports). Fix: `api/tsconfig.json` is now standalone (`tsc -b` uses `api/tsconfig.build.json`), and the Vercel build command runs `npm run build:api`, which bundles each function with esbuild. Verified with `@vercel/node` 31.0.2 on a clean clone (`npm ci`, then the build command with `VERCEL=1`): all 7 functions build, load, and answer (health 200; the others return their own validation errors, or "no provider" without keys). Still to do: the production URL and smoke results.
- **URL: not deployed.** On 2026-11-15 (code-freeze day) there is still no Vercel project linked to the repo, `main` is the Phase 0 skeleton and C's and B's work is not merged, so the final production deploy and smoke check (P6 task 5) could not run. When the project exists and Merge 2 is done: `npm run smoke -- <url>` (now also checks `X-Frame-Options` and CSP), then the phone checks, then record the URL here.

## Done

**New features, Phase 3: AI evidence guard + developer API (2026-11-20).**
- **Evidence guard** (`api/_lib/truth.ts` `unsupportedClaim`, used by `cleanOutput` and `/api/ask`). AI text that states a fact no check found is dropped. The AI score still counts, and the app falls back to its own text. Dropped text:
  - report counts, "blacklisted" or "known scammer", unless the device's own lookup found the value (KNOWN_INDICATOR or BLOCKLISTED);
  - "verified" or "confirmed fraud" claims;
  - a UPI ID, Indian mobile or 1800 number, or website that is not in the message (for Ask: the question and FAQ references) and not official (.gov.in, .nic.in, RBI, NPCI; 1930 is fine).
  - For Ask, this means no invented helpline numbers.
  - Limitation: advice naming a bank's own website is also dropped unless the message has it. That's the conservative side.
- **`POST /api/analyze`** (developer sandbox, `api/analyze.ts`):
  - The engine on the server: no AI, no link expansion, no domain lookup.
  - Returns `{ result, attackStory, tactics }`.
  - Text ≤ 20,000 characters, kind detected when missing, 30/min/IP, no CORS, the text is never logged.
  - Bundled by `build:api` (1.27 MB with the model).
  - Verified with `@vercel/node` 31.0.2 on a clean clone: fake KYC → 200, scam, 221 ms.
  - In `scripts/smoke.ts` and SPEC.md §6.6.
- **Tests:** API 60/60 (evidence guard, analyze endpoint, its rate limit, no CORS, no text in logs).

**New features, Phase 2: "understand the scam" (2026-11-20).** Everything appears in existing UI, with no contract change.
- **Attack story** (`pipeline/story.ts`):
  - When a flagged result shows three or more stages (hook → pressure → device → money), one sentence is added at the **end** of the explanation, in all four languages.
  - English example: "How this scam works: pretends to be your bank → threatens to block your account → sends a link to a fake website → asks for your OTP."
  - Hindi example: "यह ठगी ऐसे काम करती है: आपका बैंक होने का दिखावा करता है → …"
  - Elder mode's first sentence is unchanged.
- **Tactics:** `attackStory()` and `manipulationTactics()` are exported from `@akshi/engine` for B (chips or an attack-replay timeline later).
- **Payment truth for messages** (`claims/truth.ts`): "You will receive ₹4,999" vs "Entering your UPI PIN sends ₹4,999 from your account to refund.desk@ybl". It also covers QR-to-receive. The collect form already had its own row.
- **Authority consistency:**
  - Police, court or government claims with a personal UPI ID are a mismatch.
  - "Stay on the call / keep it secret" is a mismatch: there is no "digital arrest" in Indian law.
  - A personal mobile number only gets "could not be verified as official" (`mismatch: false`): an unfamiliar number is not proof.
- **Strings:** 25 step phrases, 7 tactic names and 6 claim templates in en, hi, te and bn. Non-English files are still marked `_review: pending`.
- **Scores:** no score changes.
- **Tests:** `test/story.test.ts` (10). Engine and web suites pass, except B's known timing flake in `scanFlow.test.tsx`, which passes on a rerun.
- **Known issue seen while testing:** "Stay on this video call" and "a case is registered against you" are not in the lexicons (no STAY_ON_CALL or THREAT_LEGAL), so a written "digital arrest" can score only Suspicious with the category task_job. A lexicon change waits for C's validation analysis.

**New features, Phase 1: adversarial hardening (2026-11-20).** The user asked for features that need no UI change and no contract change. Phase 1 catches disguised scam words.
- **Matching view** (`rules/view.ts`, used by `matchRules`) undoes disguises before the lexicons run:
  - Cyrillic and Greek lookalikes are folded to Latin.
  - Split letters are joined: "S H A R E", "O.T.P.", "P*I*N", emoji between letters.
  - A fully spaced-out phrase is split back into words using the Latin lexicon vocabulary ("S H A R E Y O U R O T P" → "share your otp").
  - A letter repeated three or more times is reduced to one. The words around it are also read with two, because "CVVVV" is "CVV".
  - Then the existing digit-for-letter swaps run.
- An index map sends every match back to the original characters, so underlines stay right. "/" and apostrophes end a run, so "a/c" and "don't" are untouched.
- **The model reads the same undisguised text** (`modelText`).
- **Evasion suite** (`test/adversarial.test.ts`): 12 base scams (en, Hinglish, hi, te, bn) × 9 disguises applied to the words a scammer would hide.
  - Main signal still found: **50/108 before → 108/108 after**.

    | Disguise | Before | After |
    |---|---|---|
    | Spaced | 3 | 12 |
    | Dotted | 2 | 12 |
    | Starred | 3 | 12 |
    | Homoglyph | 1 | 12 |
    | Repeated | 5 | 12 |
    | Emoji | 1 | 12 |
    | Leetspeak | 11 | 12 |
    | Zero-width | 12 | 12 |
    | Mixed case | 12 | 12 |

  - 4 genuine messages × 9 disguises: 0 become "scam".
- **No regression on validation** (`npm run eval -w @akshi/eval -- --split val`): full_no_ai F1 99.6%, false alarms 0.3%, genuine bank, OTP and UPI messages flagged 0.0% of 160. All three are unchanged.
- **Cost:** matching a short chat turn is about 20% slower (300 random turns: 152 → 185 ms). The view itself is about 10 ms per 50 KB.
- **Lexicon gap seen while writing the suite:** "Paise receive karne ke liye apna UPI PIN dalo" fires ASKS_PIN, not RECEIVE_WITH_PIN. Not fixed: a lexicon change waits for C's validation analysis.

**C's Phase 4 requests (2026-11-18), branch `feat/engine` (goes to `main` with PR #2).** C opened PR #3 (Phase 4: model `2026.11.18-a`, dataset 3,579 rows) and PR #4 (tuned calibration: rules 0.30 / model 0.35 / links 0.35, thresholds 70 / 40). All fixes below come from C's **validation** error analysis (`docs/eval-notes.md`, "For A"); A did not read any test-split message.

- **Calibration tests (C's request 1, unblocks PR #4):** `fusion.test.ts` and `model.test.ts` now read the weights from the calibration in use instead of hard-coding 0.45 / 0.35 / 0.20.
- **Negation in Telugu and Bengali (request 2; eval-notes 1–3):** these languages put the negation at the end of the clause ("…పిన్ ఎంటర్ చేయడం అవసరం లేదు", "…పాస్‌వర్డ్ అడగదు", "…চায় না"). `isNegated` now checks the rest of the sub-clause (up to a comma or full stop) and never/nobody before the phrase. Conditionals are threats, not negation, in every language ("OTP না দিলে…", "OTP नहीं दिया तो…", "…नहीं तो"); that also fixes an older bug where those dropped the OTP ask. New Telugu and Bengali `SAFETY_ADVICE` patterns ("the bank never asks…", "don't tell **them** to anyone"); a scammer's bare "don't tell anyone" is still `SECRECY`.
- **UPI ID before a full stop (request 3; eval-notes 9):** "…to sample@ibl. All members…" is now extracted. Only a dot followed by a letter or digit makes it an email domain.
- **Lexicon gaps (request 4; eval-notes 4–10, 12–16):** 64 general phrases and patterns: English OTP asks by reply/code, QR-to-receive, spaced "P.I.N", task-job "recharge to withdraw" / "combo task", "before 6 PM"; Hinglish wrong transfer and "accept karke PIN daal do"; Telugu secrecy, stay on call, police threat, withdrawal fee, account freeze, "n times assured"; Bengali task fee, the photos-to-contacts loan threat (now `loan_app`), "within N hours". `test/eval-fixes.test.ts` uses A's own sentences in the same patterns, plus guards (a genuine OTP SMS, a mobile recharge receipt, real asks and threats in Telugu and Bengali stay flagged).
- **Not fixed: eval-notes 11** (Hindi "stranded at the airport, send money, I'll return it", expected `romance`). No signal fits; a new one is a contract change (§9.4) during the code freeze.
- **Speed:** a 50 KB chat re-ran the rules on every turn for the escalation pass. Each distinct turn is now scored once, and only the other person's turns are re-read. Slowest fuzz input 884 → 594 ms. The fuzz test now times CPU work (parallel test files can't fail it) and warms up on one large input per kind.
- **Rehearsal on C's branches** (`feat/data-calibration` + these fixes, C's model and tuned calibration): typecheck 0 errors, lint clean, **559 tests pass**. C's eval, full system without AI:

  | Split | F1 | Precision | Recall | False alarms | Genuine bank/OTP/UPI flagged |
  |---|---|---|---|---|---|
  | Validation, C's PR #4 (before these fixes) | 97.6% | 97.2% | 98.0% | 2.3% | 3.75% |
  | Validation, with these fixes (optimistic: fixes came from it) | 99.6% | 99.6% | 99.6% | 0.3% | 0.0% of 160 |
  | **Test, C's PR #4 (before)** | 93.4% | — | — | 7.1% | 12.9% |
  | **Test, with these fixes (reported only)** | **95.7%** | 96.7% | 94.7% | **2.9%** | **4.3% of 140** |

  Test by language: en 96.5%, hi 95.2%, te 92.0% (precision 88.1%), **bn 100%** (was 81.4% at Merge 1). Statements: 6 of 6, no false flags.

**Merge 1 rehearsal (2026-11-17), branch `feat/engine`.** C opened PR #1 (`feat/data` → `main`: 276 files, all in C's area plus `package-lock.json`; CI `check` and `e2e` pass). Before anything reaches `main`, A merged `origin/feat/data` into a throwaway copy of `feat/engine` (lockfile: took C's, `npm install` re-added `tldts-icann`) and ran everything against C's real model `2026.11.16-a`.

- **First run: 12 of 518 tests failed, no crashes.** Causes and fixes (all in A's code, now on `feat/engine`):
  - The model's **category** overrode the rules (C's category output is weak for now: Hindi bill-disconnection → `refund_cashback` 0.88, guaranteed-returns → `job_task` 0.99). §8.4 is now rules first; the model fills in only when no rule names a category (SPEC_A §8.4 updated).
  - The model ran on **bare lookups** and scored a lone phone number 0.97 and `https://example.org` 0.68 (`suspicious`). The model layer now skips `url`, `upi_id`, `phone` and `qr` inputs.
  - One golden scam ("VIP trading group … guaranteed returns of 5% daily. Double your money") fell to `no_signs` 37: the model gave it 0.27. `TOO_GOOD_RETURNS` now has a floor of 45 when paired with urgency, a fee, secrecy, a link or an app; three genuine FD/SIP adverts with the same phrases stay `no_signs` (25–31).
  - FAQ search with C's 34 items: "where" matched "…and where?" in the privacy item. Question words are now stopwords, 5+ letter words match their longer forms (complain ~ complaint), plus a small synonym map. Every FAQ item still finds itself from its own question in every language.
  - Tests that assumed the stub model (stage list, scoreLive = analyze, the AI +15 baseline, first-scan model load in the fuzz run) now work with either.
- **C's request 2 checked and a bug fixed:** a new `test/layers.test.ts` turns each of `model`, `links`, `indicators`, `ai` off and checks the layer is unavailable, contributes 0 and never runs, and that `expandLinks: false` + `domainAge: false` never touch the network. It found that `links: false` still allowed brand-vs-link `BRAND_MISMATCH` (source `url`), so C's `rules_only` was not purely rules; fixed.
- **C's request 1:** `eval` has its own `typecheck` script, which the root `typecheck` already runs (`tsc -b && npm run typecheck --workspaces --if-present`) — covered once `feat/engine` reaches `main`; no reference needed.
- **After the fixes, merged tree:** typecheck 0 errors, lint clean, **526 tests pass** (C's JS tests included); `feat/engine` alone (stub model) 418 pass. Benchmark on C's 200 validation texts with the real model: analyze **p95 4.2 ms** (p50 0.7, max 16.4); scoreLive 0.8 ms per 1,000 chars; engine core 54.3 KB gz without lexicons.
- **First real eval (C's harness, held-out test split, 433 messages; A tuned nothing on it):**

  | Configuration | Precision | Recall | F1 | False-alarm rate |
  |---|---|---|---|---|
  | rules_only | 95.8% | 54.0% | 69.1% | 2.3% |
  | rules_model | 97.1% | 79.3% | 87.3% | 2.3% |
  | full_no_ai | 97.4% | 88.7% | 92.9% | 2.3% |

  By language (full_no_ai): en F1 94.6%, hi 92.6%, te 100%, **bn 81.4% (precision 82.8%: every false alarm is Bengali)**. Statements: 6 of 6 planted scams caught, 0 false flags per 100.
- The Vercel preview of PR #1 fails because `vercel.json` builds `@akshi/web`, which arrives only with B's merge; expected, not a fault in C's PR.

**Phase 6 — hardening and release prep (2026-11-15), branch `feat/engine`.** Merge was not possible (main unchanged, C and B unmerged); everything below is on `feat/engine`. 410 tests pass (engine 309, API 50, contracts 45, stubs 6); typecheck, lint, `npm run size` (core 54.2 KB gz without lexicons) pass.

- **Fuzz (§15), `test/fuzz.test.ts`:** 1,000 seeded inputs over all nine input kinds — 40 × 50 KB pastes, emoji and ZWJ sequences, mixed and RTL scripts, lone surrogates, control and bidi characters, unbalanced brackets, 30 broken URLs, 20 malformed `upi://` strings, empty and whitespace-only input, absurd collect amounts, broken chat timestamps and email headers. No throws; every result passes `AnalysisResultSchema`; slowest **562 ms** (a 50 KB paste; budget 1 s); no raw error text (`Error`, `undefined`, `NaN`, `[object …]`, stack frames) in explanation, signal or claim text. scoreLive, detectInputKind, maskPII, parseUpiUri, searchFaq, the live listener and inspectUrl never throw on the same inputs. No code fixes were needed.
- **Error states, `test/errors.test.ts`:** network error, HTTP 429, 500, 503, non-JSON, wrong-shape JSON, timeout (fake timers past every deadline) and offline (no fetch at all). Each gives exactly the fully local result (same score, verdict, category and explanation), `aiUsed: false`, `offline: true`, AI layer unavailable with share 0, links layer still available, no `expanded`/`domainAge`, no AI_FLAG, ai stage failed/skipped, no raw error in UI text. askAssistant falls back to the offline FAQ answer; communityReports/reportToCommunity → null; apiHealth → offline; inspectUrl → the local finding. A cancelled scan rejects with AbortError (the UI treats that as cancel). The API's own failure paths (provider timeout 504, no provider 503, invalid output, 429) were already covered in `api/_test`.
- **Security review:**
  - Git history (45 commits, all branches): only `.env.example` (empty values) was ever committed; no Groq/Google/OpenAI-style keys, `*_KEY|TOKEN|SECRET=` values, Upstash URLs or private keys. `.env` is gitignored.
  - CORS: no `Access-Control-*` header anywhere and no OPTIONS handlers → same origin only (tested).
  - SSRF guard: all expand tests pass; the metadata address is refused before connecting.
  - Logs: every API log line is typed metadata (route, status, ms, provider, counts, fixed error codes); a test turns logging on and drives all seven endpoints with a marker in every text/URL/value — no line contains it or the client IP. dev-api logs path without query. The engine logs only the invalid-calibration warning.
  - Rate limits: ai 20/min, ask 20/min, expand 60/min, domain-age 60/min (all with retry-after), reports POST 10/day — **fixed:** `/api/reports` GET had none; now 60/min/IP for GET and POST (protects the Upstash free quota).
  - AI responses: zod-validated on the server and again in the engine; quotes must be exact substrings of the masked text (both sides). **Fixed (truth rules §1.3):** model text was only *asked* not to say "safe". New `api/_lib/truth.ts` detects "safe / not a scam / genuine / nothing to worry" in English and the "safe" stem in Hindi, Telugu and Bengali: such AI explanations and advice are blanked (the AI score still counts and the engine shows its own explanation), such red-flag reasons are dropped, and such `/api/ask` answers are rejected (next provider, then the offline FAQ answer).
  - Masking: only `maskPII`'d text goes to `/api/ai/analyze` and `/api/ask`; vision sends the image (opt-in); reports send the reported value only.
  - **Fixed:** `vercel.json` now sends `X-Frame-Options: DENY` and `Content-Security-Policy: frame-ancestors 'none'; object-src 'none'; base-uri 'self'` (no script restrictions, so OCR workers and wasm are unaffected).
  - Dependencies: `npm audit --omit=dev` → 0 vulnerabilities; dev-only minimatch advisory via typescript-eslint 8.72.2 (still the latest; lint only).
- **README (task 4):** there is no README on any branch (C owns it) — request below.

**Phase 5 — calibration, performance, deploy prep (2026-11-15), branch `feat/engine`.** `git merge origin/main`: already up to date. 381 tests pass.

- **Eval-driven fixes (task 1): not started — blocked.** There is no C eval report: `packages/content/src/eval-report.json`, `eval/out/report.md` and `docs/eval-notes.md` do not exist on any branch and `feat/data` has no commits. Nothing was tuned; the golden suite was not changed.
- **Calibration (task 2):** analyze() and scoreLive() already read thresholds, fusion weights and the AI blend from `loadCalibration()`. New `pipeline/calibration.ts` checks C's values by hand (no zod in the core): `0 < suspicious < scam < 100`, weights in [0, 1] with `rules > 0`, `aiBlend` in [0, 1]; anything invalid (or a throwing loader) falls back to the spec defaults as a whole, with one console warning. Severity keeps the §7.3 bands but is clamped to the verdict, so moved thresholds cannot give "scam / medium" or "No warning signs found / high". `test/calibration.test.ts` mocks C's loader and checks verdicts, layer weights, scoreLive and the fallback.
- **Performance (task 3), SPEC_A §14:**

  | Budget | Result |
  |---|---|
  | `scoreLive` 1,000 chars < 5 ms | **2.2 ms** median (laptop) |
  | `analyze` p95 < 150 ms, model loaded, offline, ≤ 2,000 chars | **17.4 ms** p95 (p50 4.7, max 23) on 200 messages |
  | Engine core ≤ 60 KB gz excluding lexicons and model JSON | **54.2 KB** (60.0 KB with the two Latin lexicon packs) |
  | Lexicons lazy per script, ≤ 40 KB gz total | **13.7 KB** total; Devanagari 3.0, Telugu 2.7, Bengali 2.5 KB load on first use |

  - The analyze benchmark (`test/perf.test.ts`) uses C's 200 validation texts (`packages/model/test/parity-fixtures.json`) and C's model when they exist. Until then it runs on a synthetic 200-message corpus (four languages, scam and genuine, chats, emails, 40–2,000 chars) with a **proxy model** built to C's §4.1/§4.4 spec (same featuriser, 20,000-feature cap, TF-IDF + L2, sparse category logits, top-25 contributions with spans). **Rerun after Merge 2 for the real number.** Stage p95: links 6.2 ms, patterns 7.0 ms, model 7.2 ms.
  - Bundle work: tldts → **tldts-icann 7.5.2** (same API and maintainer; the engine never enabled private suffixes, so results are identical — checked on 34 hosts and the full suite; −16 KB gz). Romanised Hindi split out to `hi-latn.json` (core, with English); `hi`/`te`/`bn` lexicon packs load per script. hi/te/bn **strings** load lazily and fall back to English per string until loaded. The **analyze pipeline** is its own 11 KB chunk. `warmup(lang?)` preloads model, pipeline, packs and strings (only that language's with `lang`). analyze() awaits what it needs, so every scan is complete; scoreLive() and the live listener use what has loaded and start loading the rest (next keystroke has it). zod stays in a 30 KB lazy chunk.
  - **`npm run size`** (`scripts/bundle-size.ts`) builds a scan entry (`analyze`, `scoreLive`, `warmup`) with Vite, minifies, gzips, separates eager and lazy chunks and exits 1 over budget. Total of all engine chunks: 126 KB gz.
  - **Found: Vite 8 (Rolldown) copies the tldts trie three times.** Its default `inlineConst` inlines tldts's large exported `labelText` string at each use site: the scan entry's core goes from 59.7 to **102.8 KB gz**. Setting `build.rolldownOptions.optimization.inlineConst: false` fixes it — B's request below.
- **Deploy prep (task 4):** `npm run smoke -- https://<project>.vercel.app` covers the API half of §16 (app shell and service worker, security headers, health with both providers, expand + SSRF refusal, domain-age, AI second opinion, ask, reports), validating each reply with the contract schemas. The phone checks stay manual.
- **Requests to A (task 5):** none new. B's four requests in web.md are the ones answered in Phase 4 (below); C's log has none.
- Docs: SPEC.md §6.5 `warmup(lang?)` (additive, optional); SPEC_A §3/§5.1 lexicon layout.

**Phase 4 — chat, email, assistant, lookups, collect screens, P2 extras (2026-11-15), branch `feat/engine`.** `git merge origin/main` was a no-op: `main` is still the Phase 0 skeleton (C has not pushed `feat/data`).

- **Chat (§9, `context/chat.ts`):** WhatsApp iOS (`[dd/mm/yy, hh:mm(:ss) AM]`) and Android (`dd/mm/yyyy, hh:mm (pm) - `) exports with continuation lines and the invisible LRM marks iOS adds, `Name:` lines (≥ 3), else one turn per line; system lines ("end-to-end encrypted", "media omitted") are `unknown`. Senders: You/Me/आप/మీరు/আপনি… → `me`; otherwise the first speaker is `them` and the most frequent other speaker is `me`. Per-turn `scoreLive` risk with offsets. ESCALATION (0.2) when (a) a strictly rising run of ≥ 3 `them` risks ends ≥ 60, or (b) `them` turns go problem → link/app → OTP/PIN/payment (a greeting may lead; problem and link may share a turn); its spans are the turns involved.
- **Email (§9, `context/email.ts`):** From / Reply-To / Subject / Return-Path, attachment names (not file names inside URLs). BRAND_MISMATCH when a brand named in the display name, subject or body does not own the sender domain; REPLY_TO_MISMATCH when Reply-To or Return-Path is on another registrable domain; RISKY_ATTACHMENT for .apk/.exe/.scr/.html/.htm/.js/.bat/.msi and invoice/KYC-style .zip names. Localised claims ("Sent from …, not incometax.gov.in", "Replies go to …"). Government claim + sender mismatch → `impersonation_govt`.
- **Assistant (§12.4, `assistant.ts`):** BM25 (k1 1.2, b 0.75) over FAQ question (×2), answer and tags in the user's language plus an English copy of every item, best score per item; Hindi/Telugu/Bengali stopwords; `searchFaq(question, lang, k)` exported. Offline → best FAQ answer (`mode: 'offline'`); nothing matches → localised "not covered" pointing to 1930 and cybercrime.gov.in. Online (`{ online: true }` and the device online) → `/api/ask` with the masked question and the top-3 ids; any failure falls back offline.
- **`/api/ask`:** looks the requested ids up in the bundled FAQ (max 3; ids not in the FAQ are ignored), prompt allows only those answers, ≤ 90 words in the user's language ending with the next action, `covered: false` → the 1930 / cybercrime.gov.in answer; Groq → Gemini, 8 s each; question ≤ 1,000 chars; 20/min/IP.
- **Lookups (`upi_id`, `phone`, `url`):** explanation from the indicators and blocklist even with no other signal — "This UPI ID appears in 7 scam reports (Fake KYC update, sample data).", "You blocked this number earlier.", or for unknown values "No reports found for this website in our sample list. That does not prove it is genuine, so check before you pay or share anything." Category falls back to the indicator's category.
- **Screenshots (§10):** collect-request screens ("… has requested ₹2,000", Pay / Decline, and Hindi/Telugu/Bengali equivalents, with an amount) → COLLECT_REQUEST (+0.15); refund/prize/receive wording on the screen adds RECEIVE_WITH_PIN (floor 85) and the PIN statement; collect actions. Payment receipts are not matched. Weak OCR: `isWeakOcr(ocr)` (confidence < 55 or < 15 characters, exported from both entries) caps analysis confidence at 0.6.
- **P2 — cloud vision (M2.3):** `POST /api/ai/vision` with Gemini (`GEMINI_API_KEY` + `GEMINI_VISION_MODEL`), PNG/JPEG/WebP ≤ 1.5 MB (raw base64 or data URL), transcription-only prompt that ignores instructions in the image, 8 s, 20/min/IP. Engine: `ocrWithCloudVision(blob, lang)` in `@akshi/engine/browser` returns an `OcrResult` without boxes (confidence 75) or null.
- **P2 — live listen (M1.15):** `createLiveListener(lang)` → `push(text, isFinal)` returns `{ score, alerts, transcript }`; each call-danger signal (OTP, PIN, CVV, screen sharing, receive-with-PIN, QR-to-receive, APK, stay on call, legal threat, secrecy, advance fee) alerts once; OTP/PIN/screen-share alert on interim text, others once the words are final. Rules only, synchronous, nothing leaves the device.
- **P2 — community reports (M8.6, §12.5):** `GET/POST /api/reports` over Upstash's REST pipeline API (no SDK), env `KV_REST_API_URL`/`KV_REST_API_TOKEN` or `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` (read in `api/_lib/redis.ts`); key `rep:<type>:<sha256(normalised value)>` → `{count, category}`; counts shown only from 3; 10 reports per IP per day under `rl:rep:<sha256(ip)>` with a 24 h TTL; raw values and IPs never stored or logged. Engine: `communityReports(type, value)` → `IndicatorMatch` (`source: 'community'`) or null; `reportToCommunity(type, value, category)`.
- **Bundle (B's request 2):** the engine no longer imports fixtures; zod schemas for network replies load lazily (`src/schemas-lazy.ts` → `@akshi/contracts/schemas`), so the offline core carries no zod. Measured with esbuild (minified, gzip -9), engine core without C's packages: **≈ 112 KB gzipped** (tldts public-suffix trie, strings in four languages, lexicons); zod loads only with the first network call. C's content *stub* still pulls zod through `@akshi/contracts/fixtures` (see Requests).
- **Contracts (internal refactor, exports unchanged):** enum arrays moved to `packages/contracts/src/enums.ts`; new subpath export `@akshi/contracts/schemas`. No type or shape changed, so no §9.4 contract PR was needed.
- **Root:** `npm run typecheck` = `tsc -b && npm run typecheck --workspaces --if-present` (covers apps/web as soon as it has a `typecheck` script — B's request 1).
- **Tests:** 369 repo-wide (engine 276 incl. **60 golden cases**, contracts 45, API 42, stubs 6): chat formats, senders, both escalation rules, the contracts chat and email fixtures (both `scam`, chat `courier_customs`, email `impersonation_govt`), genuine order email and family chat → `no_signs`, assistant answers every FAQ item from its own question in every language it has, paraphrases and romanised Hindi, lookups, collect screens in four languages, weak OCR, vision, live listen, reports. No real network.

**Phase 3 (2026-11-15):** model layer (stub-safe), `maskPII`, self-hosted OCR (tesseract.js 7.0.0 + tessdata_fast in `packages/engine/assets/`), AI second opinion (masked text, §8.2 blend), real `/api/ai/analyze` (Groq → Gemini), SSRF-guarded `/api/expand`, RDAP `/api/domain-age`, `/api/health`, rate limits. **Phase 2:** links, UPI, QR, collect form, claims vs reality, fusion. **Phase 1:** detection, entities, lexicons, rules, strings, `scoreLive`. **Phase 0:** skeleton.

## In progress

- **Merge 1 (C's PR #1):** rehearsed and green (above); waiting for the human to merge PR #1. Then A merges `origin/main` into `feat/engine` for real, reruns everything and opens `feat/engine → main`.
- **Merge 1 and Merge 2 (C → A → B), earlier note:** both were waiting — on 2026-11-15 `origin/main` was the Phase 0 skeleton, `origin/feat/data` had no commits and there were no PRs. When the human confirms C's PR is merged: merge `origin/main` (lockfile: take main's, `npm install`, retest), rerun all tests, the golden suite against C's real model (record verdict changes here), `npm run size` and the analyze benchmark (C's model and validation texts), push, open `feat/engine → main`.
- **Eval-driven fixes:** waiting for C's eval report and `docs/eval-notes.md` (validation false positives/negatives). Will fix the ones in rules, lexicons and the link/UPI analysers, from validation findings only.
- **Production deploy (§16):** waiting for the human to create the Vercel project (below) and for Merge 2. Then: confirm `main` builds, `/api/health` shows both providers, `npm run smoke -- <url>`, the phone checks, and the URL goes at the top of this log (and to B and C).

## Deferred

- Playwright support for B's e2e tests (B's suite drives the UI; A has no browser-only engine paths left untested except `ocrImage` / `ocrWithCloudVision`, which need a DOM).
- POST variants of `/api/expand`, `/api/domain-age` and `GET /api/reports` so values stay out of platform request logs (API change; after the freeze).
- Manual acceptance with real keys (`/api/ai/analyze`, `/api/ask`, `/api/ai/vision`) and a real Upstash store — needs the human's keys (steps below).

## Known issues

**For the demo recording (until Merge 2 and a deploy happen):**
- **The engine on `main` is the Phase 0 stub.** A demo from `main` or a deploy of `main` shows stub results. Record from a build that includes `feat/engine` (and B's `inlineConst` setting), or after Merge 2.
- Call `warmup(lang)` when the scan page opens; otherwise the first keystroke of Hindi/Telugu/Bengali text in the live score can miss phrases and show English labels (the full scan is always complete).
- Avoid pasting very large chat exports on a slow phone: 50 KB takes up to ~0.6 s on a laptop, so it may pass 1 s on a mid-range phone.
- AI second opinion and the online assistant need the keys in Vercel; without them the app silently shows local results (by design) — check `/api/health` before recording.
- Domain age and link expansion depend on rdap.org and the target sites; a slow answer is dropped after 3 s, so a demo link may show no age. Use a link already tried once (cached 1 h / 10 min).
- Vercel's platform request log records query strings, so `/api/expand?url=`, `/api/domain-age?domain=` and `/api/reports?value=` values appear there (our own logs never include them; Hobby log retention is short). Changing these to POST is an API change, left for after the freeze.

- **Unverified domains / handles** (from P2): IndusInd `.bank.in`, Yes Bank's exact `.bank.in` name, several legacy and non-bank domains; PSP handle table not checked against NPCI (client-rendered pages).
- **Email false-positive risk:** banks sometimes send from domains not in the registry (for example a separate alerts domain); such genuine emails would get BRAND_MISMATCH. Add those domains to `links/registry.ts` when seen.
- **Chat sender guess:** without "You"/"Me" names, the first speaker is assumed to be the other person. If the user exported a chat they started, senders are swapped (risk scores are unaffected; only `me`/`them` labels and escalation's choice of turns).
- **Cloud vision sends the image**, which cannot be masked — the UI must ask before calling `ocrWithCloudVision`.
- **Lazy packs and the first keystroke:** without `warmup(lang)`, the first `scoreLive` call on Devanagari/Telugu/Bengali text misses that script's phrases (the pack starts loading; the next call has it) and labels are English until the language's strings load. analyze() always awaits them.
- **Benchmark is a proxy** until C's model and validation texts land (same featuriser and feature cap, random weights).
- **AI_FLAG ids repeat** (one per red flag); UI lists must not key by `id` alone.
- **Rate limits, caches and the in-memory limiter are per function instance**; reports use Redis and are global.
- **esbuild code splitting** hoists the contracts schemas module into a shared up-front chunk; Rollup/Vite drop the unused re-export under `sideEffects: false`, so B's real build should keep zod lazy — B please confirm in the bundle report.
- Carried: deviations listed in Phase 2/3 (single-item fusion, lookalike token length, identity signals in rules, website-QR floor 40, phone mismatch needs pressure, ASKS_OTP floor 45), Vercel compiling `api/*.ts` with `.ts` workspace imports unverified, typescript-eslint minimatch advisory (still no fixed release; 8.72.2 is latest on 2026-11-15), tool escaping quirks on this laptop.

## Requests

**New features (2026-11-20):**

- **To C (README):** please add a short "Developer API" section:
  - `POST /api/analyze` with `{"text": "...", "lang": "en"}` (kind optional) returns `{ result, attackStory, tactics }`.
  - It uses the same engine: no AI, no link expansion, no domain lookup.
  - 30 requests a minute, and the text is never logged.
  - curl example: `curl -X POST https://akshi-rakshak.vercel.app/api/analyze -H 'content-type: application/json' -d '{"text":"Your SBI account will be blocked. Share the OTP now.","lang":"en"}'`.
  - For the Proof page, the evasion results: 50/108 → 108/108 under 9 disguises (above).
- **To B (when the freeze lifts, optional):**
  - `attackStory(signals, lang)` and `manipulationTactics(signals, lang)` are exported from `@akshi/engine`, for tactic chips or an attack-replay timeline on `/scan/:id`.
  - Until then the story already shows as the last sentence of the explanation.
- **To C (validation):** add written "digital arrest" families to validation, e.g. "stay on this video call", "a case is registered against you", "pay the security deposit". A fixes the lexicon gaps from validation findings.

**Answers to B's open requests (web.md, Phase 6), 2026-11-17:**

1. **Root typecheck covers apps/web:** yes, with no reference needed. The root `typecheck` is `tsc -b && npm run typecheck --workspaces --if-present`, and `apps/web` has `"typecheck": "tsc -b"`, so it runs once `feat/web` reaches `main`.
2. **Engine bundle:** done. No fixtures, `sideEffects: false`, lazy zod/pipeline/lexicons/strings; core 54.3 KB gz without lexicons. B's `inlineConst: false` and loading the engine after first paint are already on `feat/web`.
3. **Fake KYC sample:** Scam 80 with the real engine (Phase 2 fix); B's e2e can keep expecting a clear Scam.
4. **typescript-eslint advisory:** still no fixed release (8.72.2 is the latest).
5. **`.tsbuild/**` in ESLint ignores:** already in `eslint.config.js`; `npm run lint` passes with `.tsbuild/` present.

For B's Merge 2: after merging `origin/main` (C's and A's work), the `stageText` fallback (`TODO(M1)`) can become a plain re-export; the model stage now reports `done`, so the stage ticker shows it.

**New after C's Phase 4 (2026-11-18):**

- **To C:** requests 1–4 in `data.md` are done on `feat/engine` (above); request 5 noted. Once PR #2 is on `main`, merge `origin/main` into `feat/data` and `feat/data-calibration` (PR #4 then passes: 559 of 559 in A's rehearsal), rerun `npm run eval`, and commit the report.
- **To C (next error analysis):** the remaining test-split false alarms are Telugu (precision 88.1%; C's note points at the bank-advisory family `bankinfo-te-02`). A did not read those messages and will not. Please add **new Telugu bank-advisory families to validation** (other banks, other phrasings: "will not ask", "never shares", "only on the official app") so the next fix comes from validation. Genuine bank messages flagged on test are 4.3%, still above the 3% target.
- **To C / the human:** eval-notes 11 (Hindi "stranded, send money, I'll return it", `romance`) needs a new signal ID, which is a contract change (SPEC.md §9.4). Left for after the freeze unless the human wants it now.

**New at Merge 1 (2026-11-17):**

- **To C (Phase 4 error analysis, from validation only):** (1) Bengali false alarms — all test-split false alarms are `bn`; please look at Bengali genuine messages in validation. (2) Investment scams with "guaranteed / daily returns" scored low (0.27 on a clear case). (3) The category head leans to `refund_cashback` (0.88 on a Hindi bill-disconnection message, 1.00 on a bare short link); A now uses it only when no rule names a category. (4) Bare identifiers get high pScam (phone number 0.97) — A no longer runs the model on bare `url`/`upi_id`/`phone`/`qr` inputs, so no need to train for those. Rule, lexicon and link misses you find, list in `docs/eval-notes.md` as agreed.
- **To C:** rerun `npm run eval` after Merge 2 (engine on `main`): the numbers above came from A's rehearsal, the committed report on `main` is still the stub's.

**New in Phase 6:**

- **To C — README (missing on every branch):** please document the environment variables exactly as the code reads them:
  - `GROQ_API_KEY`, `GROQ_MODEL` (a Groq model with JSON Schema structured output, e.g. `openai/gpt-oss-20b`)
  - `GEMINI_API_KEY`, `GEMINI_MODEL` (Flash or Flash-Lite), `GEMINI_VISION_MODEL` (image input; can be the same model)
  - `KV_REST_API_URL` + `KV_REST_API_TOKEN` **or** `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` (optional; injected by the Vercel Upstash integration; without them `/api/reports` answers 503 and the app works without community counts)
  - `PORT` (optional, local `npm run dev:api`, default 3001)
  - Local: copy `.env.example` to `.env`; Vercel: same names for Production and Preview. `/api/health` shows which providers are set, never the values. All AI features are optional: text checks work offline without any key.
- **To B:** model-written AI explanations can now be an empty string (truth guard); the engine already falls back, but if the UI ever shows `AiAnalyzeResponse.explanation` directly, hide it when empty.

**New in Phase 5:**

- **To B — Vite 8 duplicates the tldts trie (−43 KB gz on the scan page):** add to `apps/web/vite.config.ts`:
  ```ts
  build: { rolldownOptions: { optimization: { inlineConst: false } } }
  ```
  Rolldown's default constant inlining copies tldts's ~120 KB `labelText` string to each of its 3 use sites. Measured on the scan entry: engine core 102.8 → 59.7 KB gz. Check with your bundle report (search the output for `orgmilcomschnetedugovdrrforms`: it should appear once).
- **To B — lazy engine chunks:** the engine now has lazy chunks (analyze pipeline, hi/te/bn lexicon packs and strings, zod schemas). Please make sure the service worker precaches **all** engine chunks so the airplane-mode scan works in every language after one visit (vite-plugin-pwa's default `globPatterns` covers `**/*.js`; check the hashed `analyze-*`, `hi-*`, `te-*`, `bn-*`, `schemas-*` files are in the precache manifest). Call `warmup(userLang)` when the scan page opens (and `warmup(newLang)` on a language switch). Before warmup, `scoreLive` may miss Indic-script phrases on the first keystroke and show English labels; analyze() is always complete.
- **To C:** when your eval runs, please list the validation false positives and false negatives that come from rules, lexicons or the link/UPI checks in `docs/eval-notes.md` (text, expected, got, which signal) — A fixes those. Also, the parity fixtures path `packages/model/test/parity-fixtures.json` is what A's analyze benchmark reads (array of `{ text, lang }`, or `{ cases: [...] }`).
- **To the human — Vercel (§16 step 1):** vercel.com → Add New → Project → import `Vidur-2007/AkshiRakshak` (Hobby), framework **Other**, root = repo root (the repo's `vercel.json` sets install, build and output). Production branch `main`. Environment variables for **Production and Preview**: `GROQ_API_KEY`, `GROQ_MODEL`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_VISION_MODEL`; then Storage/Marketplace → Upstash Redis → connect to the project (adds `KV_REST_API_URL`/`KV_REST_API_TOKEN`). Tell A the production URL; A runs `npm run smoke` and records the results here. The project only becomes useful after Merge 2 (main has no web app yet).

**Earlier:**


Answers to Laptop B's requests (docs/progress/web.md on `feat/web`):

1. **Root typecheck covers apps/web:** done without a tsconfig reference (that would break `tsc -b` on `main` until `apps/web` lands). Please add `"typecheck": "tsc -b"` to `apps/web/package.json`; the root `npm run typecheck` now runs every workspace `typecheck` script. A will also add the `apps/web` reference at Merge 1 if you prefer.
2. **Engine bundle** *(superseded in Phase 5: core is now 54 KB gz without lexicons, with B's `inlineConst` fix)*: fixtures are out of the engine, `sideEffects: false` is set on contracts and engine, and zod is lazy. Core ≈ 112 KB gzipped — together with the 189 KB shell that is over `/scan`'s 200 KB, so **please load the engine after first paint** (dynamic `import('@/lib/engine')` on the scan page, `warmup()` when the page opens). If that is not enough, tell A and A will split the hi/te/bn strings per language.
3. **Fake KYC sample verdict:** fixed since Phase 2 — `sample-fake-kyc` scores **80 (scam)** on `feat/engine`; you will see it after Merge 1.
4. **typescript-eslint advisory:** no fixed release yet (8.72.2 is still the latest); A will bump it when one ships.

New for B: `createLiveListener` (live listen), `ocrWithCloudVision` (opt-in; ask first — the image leaves the device), `communityReports` / `reportToCommunity`, `isWeakOcr`, `searchFaq`; chat results now include ESCALATION and real senders; lookups have a full explanation sentence.

- **To C:** please add `"sideEffects": false` to `packages/{model,insights,content}/package.json`, and do not import `@akshi/contracts/fixtures` from the real content package (it parses every fixture with zod at load time and drags zod into the web bundle). The assistant tests ask every FAQ item its own question in every language it has — keep questions distinct enough that BM25 can tell them apart.
- **To the human — keys for manual checks (local `.env`, never committed; same names in Vercel):** `GROQ_API_KEY`, `GROQ_MODEL`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_VISION_MODEL` (a vision-capable free-tier Gemini model); for reports add the Upstash Redis integration from the Vercel Marketplace (it injects `KV_REST_API_URL`/`KV_REST_API_TOKEN` or `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN`). Then `npm run dev:api` and the curl from Phase 3's notes for `/api/ai/analyze`; for `/api/ask`: `curl -s -X POST http://localhost:3001/api/ask -H "content-type: application/json" -d "{\"question\":\"Do I need my PIN to receive money?\",\"lang\":\"en\",\"faqIds\":[\"faq-pin-sends-money\"]}"`.
- Still open: open `https://www.indusind.bank.in` and `https://www.yes.bank.in` in a browser and tell A which load.
