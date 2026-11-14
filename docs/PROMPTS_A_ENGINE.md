# Prompts — Laptop A (engine, contracts, API, platform)

Paste one prompt at a time into Claude Code, from the repo root. Start each phase in a fresh session (`/clear`), because every prompt tells Claude to re-read the specs and your progress log. Wait for the phase summary before moving on. If Claude Code stops part-way (usage limit, crash), use the "Resume" prompt at the end.

## Before Phase 0 (human, ~10 minutes)

1. Install Node.js 22 LTS or newer, Git, and Claude Code. Sign in to Claude Code with Laptop A's Claude account.
2. On GitHub (team lead account): create a **public** repository `akshi-rakshak` with no README. Settings → Collaborators → invite the GitHub accounts of Laptop B and Laptop C.
3. `git clone` it, create a `docs/` folder and copy the seven files (`SPEC.md`, `SPEC_A_ENGINE.md`, `SPEC_B_WEB.md`, `SPEC_C_DATA.md`, `PROMPTS_A_ENGINE.md`, `PROMPTS_B_WEB.md`, `PROMPTS_C_DATA.md`) into it.
4. Run `claude` in the repo root and paste Phase 0.
5. When Phase 0 is pushed, message B and C: "Skeleton is on main, clone now."

---

## Phase 0 — Repo skeleton (Day 1, ~45 minutes)

```text
You are Laptop A's Claude Code session for the Akshi Rakshak hackathon project. You are the team lead's laptop and own the engine, contracts, API and platform.

Read docs/SPEC.md completely, then docs/SPEC_A_ENGINE.md. Skim docs/SPEC_B_WEB.md and docs/SPEC_C_DATA.md so you know what the other laptops expect from your skeleton.

Goal of this phase: create the repository skeleton on the main branch exactly as described in SPEC_A_ENGINE.md §2, so Laptops B and C can clone it and work independently from the first hour. Speed matters: B and C are waiting. Aim to push within 45 minutes; keep stubs simple but correct.

Do, in order:
1. Root: package.json with workspaces and scripts, tsconfig.base.json, eslint flat config with typescript-eslint, prettier config, vitest workspace config, .gitignore, .env.example (names only, from SPEC.md §10), LICENSE (MIT), CLAUDE.md copied verbatim from SPEC.md §14.
2. docs/progress/engine.md, docs/progress/web.md, docs/progress/data.md, each with the headings: Done, In progress, Deferred, Known issues, Requests.
3. packages/contracts, complete: zod schemas for every type in SPEC.md §6 (schema name = type name + "Schema"), inferred types, normalizeText (SPEC.md §7.1), all fixtures listed in SPEC.md §6.7 with realistic synthetic Indian scam content in all four languages across the set, and tests: every fixture parses; every span's text equals text.slice(start, end); normalizeText cases (three digit scripts, zero-width characters, whitespace, NFKC).
4. Stubs with the exact signatures from SPEC.md §6.5, behaving as SPEC_A_ENGINE.md §2.3 describes: @akshi/engine (with the "./browser" export), @akshi/model, @akshi/insights, @akshi/content. Put "// STUB — owned by Laptop C; replaced on feat/data" at the top of every file in the model, insights and content packages.
5. api/ stubs (health, ai/analyze, expand, domain-age, ask) using Web-standard handlers; check current Vercel documentation for the Node.js function signature for non-Next projects and use what it supports. scripts/dev-api.ts serving them on port 3001.
6. vercel.json as in SPEC_A_ENGINE.md §2.5. .github/workflows/ci.yml as in §2.6.
7. Run npm install, npm run typecheck, npm test. Everything must pass.
8. Commit on main ("chore: project skeleton, contracts and stubs") and push to origin main.
9. Create and push the branch feat/engine.

Do not build real engine logic yet. Do not create apps/web (Laptop B owns it).

Finish with: update docs/progress/engine.md, commit and push feat/engine, then print a short summary for the human that includes the exact message to send B and C ("Skeleton is on main…") and a list of anything you were unsure about.
```

---

## Phase 1 — Read stage, entities, rules, lexicons (Day 1)

```text
You are Laptop A's Claude Code session on Akshi Rakshak. Branch: feat/engine. Read docs/SPEC.md, docs/SPEC_A_ENGINE.md and docs/progress/engine.md first. Work only inside your owned paths (see CLAUDE.md).

Goal: replace the engine stub with the real read and patterns stages, while keeping analyze() working end to end (fixture-backed parts may remain for links/model until Phase 2–3).

Build, following SPEC_A_ENGINE.md §3–§5:
1. Engine folder structure from §3.
2. Language and script detection (§4.1), including the Hinglish marker list.
3. detectInputKind (§4.2) with tests for every kind.
4. Entity extraction (§4.3): URLs (with tldts), UPI IDs (not emails), Indian phone numbers with claimedAs, amounts in all four languages with Indian grouping and lakh, emails, APK mentions. All spans are UTF-16 offsets into the normalised text.
5. Signal catalog in rules/catalog.ts (§5.2): weights, floors, category hints, as one typed table.
6. Lexicons for en, hi (Devanagari and romanised), te and bn (§5.1). Meet the phrase-count targets. Write them from real-world knowledge of Indian scam wording, including misspellings and spaced-out evasions. Include SAFETY_ADVICE phrases with the "not when the message also asks for the OTP" rule, and OBFUSCATION detection.
7. Rules engine: precompiled matchers per lexicon, run only lexicons whose script appears (plus romanised Hindi for Latin text). Returns Signal[] with spans.
8. Engine strings in src/i18n/{en,hi,te,bn}.json for every signal (label + detail), category (name + one-liner), action (label + body) and stage name. Plain, short, second person. Non-English files start with "_review": "pending".
9. scoreLive(text, lang): rules only, synchronous, under 5 ms for 1,000 characters. Add a micro-benchmark test.
10. analyze(): real read and patterns stages, real onStage events and timings; remaining stages may still use simple placeholders, but the result must validate against AnalysisResultSchema.
11. Tests: at least 20 golden cases now (you will reach 40 in Phase 2) across all four languages, including the genuine OTP, debit alert and delivery cases that must come out as no_signs.

Acceptance: npm run typecheck and npm test pass; scoreLive benchmark passes; analyze results validate against the schema.

Finish: update docs/progress/engine.md (Done, Deferred, Known issues, Requests), commit in small steps with conventional messages, push feat/engine, print a summary for the human.
```

---

## Phase 2 — Links, UPI, QR, collect requests, fusion (Day 1 evening → Day 2 morning)

```text
You are Laptop A's Claude Code session on Akshi Rakshak. Branch: feat/engine. Read docs/SPEC.md, docs/SPEC_A_ENGINE.md and docs/progress/engine.md first. Work only inside your owned paths.

Goal: analyze() works end to end for kinds message, url, upi_id, phone, qr and collect_request, fully offline, without the model or AI.

Build, following SPEC_A_ENGINE.md §6 and §8:
1. links/registry.ts: official domains and brand tokens for every brand in §6.1. Use web search to confirm each brand's official domains, including the newer <name>.bank.in bank domains, and check that the .bank.in restriction to banks is still in force. Add a comment with the date you checked. Shorteners, risky TLDs, homoglyph map.
2. inspectUrl (§6.2) with lookalikeOf and a character-level lookalikeDiff, isOfficial, isShortener, isApk, risk. Network extras (expand, domain age) go through src/net.ts with a 3-second total budget and silent offline fallback; the API endpoints are still stubs, so test the client code against mocked fetch.
3. UPI handles (§6.3): PSP handle table (check against NPCI's published list of UPI apps and handles), looksPersonal heuristic, UPI_NAME_MISMATCH.
4. parseUpiUri and QR analysis (§6.4), including the "this QR opens a website" path. The explanation always shows the payee UPI ID and name.
5. Collect-request logic (§6.5).
6. Brand claims and the claimVsReality list (§8.5).
7. lookupIndicator using INDICATORS from @akshi/content plus options.blocklist (BLOCKLISTED signal).
8. Fusion, floors, verdict, severity, confidence, category, actions, explanation exactly as §8.1–§8.7, using loadCalibration() from @akshi/model for thresholds and weights.
9. actionText with tel:1930, https://cybercrime.gov.in and https://sancharsaathi.gov.in/sfc/ (Chakshu: suspected fraud communication only).
10. Golden tests to at least 40 cases (§15 list is mandatory), plus unit tests per analyser.

Acceptance: every §15 golden case passes; analyze() for each kind validates against the schema; no network call is needed for any test; npm run typecheck and npm test pass.

Finish: update docs/progress/engine.md, commit, push feat/engine, print a summary for the human, including any brand domains you could not verify.
```

---

## Phase 3 — Model, OCR, masking, API functions (Day 2) → Merge 1

```text
You are Laptop A's Claude Code session on Akshi Rakshak. Branch: feat/engine. Read docs/SPEC.md, docs/SPEC_A_ENGINE.md and docs/progress/engine.md first. Work only inside your owned paths.

Goal: the full pipeline including the model layer (stub-safe), OCR in the browser entry, masking, and real API functions. Then prepare Merge 1.

Build:
1. src/model.ts (§7): memoised loadModel(), MODEL_PATTERN signal from contributions with merged phrase spans, layer marked unavailable when loadModel() returns null. The model package is still C's stub on your branch (it returns null); test the mapping with a fake TextModel in your tests.
2. maskPII (§11) with tests for every pattern and a check that amounts and brand names survive.
3. @akshi/engine/browser ocrImage (§10): tesseract.js worker, self-hosted worker/core files and tessdata_fast traineddata for eng, hin, tel, ben stored gzipped in packages/engine/assets/ (download them from the official repositories), langPath "/engine-assets/tessdata", downscale > 1600 px, progress, word boxes with offsets into the normalised OCR text, box → signal mapping after analyze. Document in progress/engine.md exactly which files B's Vite config must copy.
4. api/ai/analyze (§12.1): Vercel AI SDK generateObject, Groq first then Gemini, model names from env, 8 s timeouts, the system prompt, prompt-injection handling, output validation (quotes must be exact substrings), no logging of text. Engine side: when options.cloudAI is true and online, call it with masked text and blend per §8.2; map AI red-flag quotes back to spans; AI_FLAG signals with source "ai".
5. api/expand (§12.2) with the SSRF guard (DNS resolution and private-range checks on every hop, ports 80/443 only, max 5 hops, manual redirects) and tests for private IPs, IPv6, decimal-IP hosts and redirect-to-private.
6. api/domain-age (§12.3) via rdap.org with caching and graceful "unavailable".
7. api/health (§12.6) and the in-memory rate limiter.
8. Make sure scripts/dev-api.ts serves all of these and reads .env.

Acceptance: tests pass with no real network calls (mock providers and fetch); with your own keys in a local .env, a manual curl to http://localhost:3001/api/ai/analyze returns valid JSON from Groq, and from Gemini when GROQ_API_KEY is removed.

Then Merge 1 preparation (C merges first, then you, then B):
- Wait until the human says C's PR has been merged into main.
- git fetch, then git merge origin/main into feat/engine. On a package-lock.json conflict take main's version, run npm install, rerun tests. Fix any integration problems that are inside your paths; write requests for anything else.
- Rerun the golden tests against the real model from C. If any golden case changed verdict, investigate and record the cause in progress/engine.md (do not silently change expectations).
- Push and open a PR feat/engine → main with gh pr create if gh is installed and authenticated; otherwise print the exact steps for the human.

Finish: update docs/progress/engine.md, push, print a summary including the PR link and anything B needs to know (OCR asset paths, env needs).
```

### Merge 1 duties (human A, team lead)

1. Merge C's PR when CI is green. Tell A's Claude Code to continue the merge steps above.
2. Merge A's PR when CI is green. Tell B to merge `main` into `feat/web` and open their PR.
3. Merge B's PR when CI is green. Tell everyone: "M1 done, merge main into your branch."
4. Connect the repo to Vercel now (SPEC_A_ENGINE.md §16 steps 1–2) and add the env vars, so `main` gets its first production deploy.

---

## Phase 4 — Chat, email, assistant, lookup, P1 polish (Day 3 morning)

```text
You are Laptop A's Claude Code session on Akshi Rakshak. Branch: feat/engine. Read docs/SPEC.md, docs/SPEC_A_ENGINE.md and docs/progress/engine.md first, including any Requests from other laptops in docs/progress/web.md and docs/progress/data.md (read-only). Work only inside your owned paths.

First: git fetch and merge origin/main into feat/engine (lockfile rule from SPEC.md §9.3); run all tests.

Build:
1. Chat analysis (§9): WhatsApp export formats (Android and iOS), Name: lines, line fallback, sender detection, per-turn risk with offsets, ESCALATION rules.
2. Email analysis (§9): headers, BRAND_MISMATCH by sender domain, REPLY_TO_MISMATCH, RISKY_ATTACHMENT.
3. Assistant (§12.4): offline BM25 over FAQ from @akshi/content in the user's language with English fallback; online /api/ask grounded only in the top-3 FAQ answers, masked question, same provider fallback; offline mode answer.
4. Lookup inputs: analyze() for kind upi_id, phone and url must include indicator matches and a clear explanation even when no other signal fires.
5. OCR collect-screen recognition (§10) and the weak-OCR path.
6. Answer every open Request addressed to Laptop A in the other progress logs. Contract changes follow SPEC.md §9.4: make them in a small separate PR to main.
7. Golden cases for chat, email, collect screenshots (from OCR text), lookup.
8. If all P0/P1 items are done: P2 items in this order — /api/ai/vision with Gemini (M2.3), a phrase-spotting helper for live listen that B can call with interim transcripts (M1.15), /api/reports with Upstash Redis through the Vercel Marketplace (M8.6, §12.5).

Acceptance: tests pass; chat and email fixtures from contracts produce sensible real results; assistant answers offline for every FAQ topic.

Finish: update docs/progress/engine.md, commit, push, print a summary.
```

---

## Phase 5 — Integrate, tune, deploy (Day 3) → Merge 2

```text
You are Laptop A's Claude Code session on Akshi Rakshak. Branch: feat/engine. Read docs/SPEC.md, docs/SPEC_A_ENGINE.md, docs/progress/engine.md, and (read-only) docs/progress/web.md, docs/progress/data.md and docs/eval-notes.md.

First: git fetch and merge origin/main (lockfile rule); run all tests.

Do:
1. Read C's eval report (packages/content/src/eval-report.json and eval/out/report.md if present) and eval-notes. For each false-positive and false-negative pattern C lists that belongs to rules, lexicons or the link/UPI analysers, fix it in your code. Do not tune on the test or handwritten splits; use C's validation findings.
2. Make sure analyze() reads thresholds and fusion weights from loadCalibration() (C owns the values).
3. Performance: measure analyze p95 on 200 validation messages with the model loaded; meet SPEC_A_ENGINE.md §14 budgets; check the engine core bundle size and lazy loading of lexicons.
4. Production deploy (§16): confirm the Vercel project builds main, env vars are set for Production and Preview, /api/health shows both providers. Smoke-check on the production URL: sample scan, QR sample, link with expansion, AI second opinion on, and an airplane-mode scan after one visit. Record the production URL in progress/engine.md.
5. Answer any Requests addressed to Laptop A.

Merge 2 (same order as Merge 1: C, then A, then B): after C's PR is merged, merge origin/main again, rerun all tests and the golden suite, push, open PR feat/engine → main.

Finish: update docs/progress/engine.md with the production URL and results of the smoke check, push, print a summary.
```

---

## Phase 6 — Hardening and release (Day 4)

```text
You are Laptop A's Claude Code session on Akshi Rakshak. Branch: feat/engine. Read docs/SPEC.md, docs/SPEC_A_ENGINE.md and docs/progress/engine.md. Code freeze is at midday: only fixes, in small PRs.

First: merge origin/main; run all tests.

Do:
1. Fuzz test (§15): 1,000 random inputs including 50 KB text, emoji, mixed scripts, broken URLs, malformed upi:// strings, empty input. No throws; analyze < 1 s each.
2. Error states: every API failure, timeout, offline and rate-limit path returns a graceful result with the right layer marked unavailable. Check that the UI-facing explanation never shows a raw error.
3. Security review: no API keys or .env in git history (search the history), CORS not opened beyond same origin, SSRF guard tests pass, no message text in any log statement, rate limits in place, AI responses validated, quotes checked. Fix anything found.
4. Confirm the README (owned by C) states the env vars correctly; if not, write a Request in your progress log.
5. Final production deploy from main after the last PRs; rerun the production smoke check.

Finish: update docs/progress/engine.md, push, print a release summary for the human with the production URL and any known issues to avoid during the demo recording.
```

---

## Utility prompts

### Resume after an interruption

```text
You are Laptop A's Claude Code session on Akshi Rakshak, branch feat/engine. A previous session was interrupted. Read CLAUDE.md, docs/SPEC.md, docs/SPEC_A_ENGINE.md and docs/progress/engine.md. Run git status and git log -10 to see where work stopped. Continue the current phase from where it stopped (the phase is the last one listed in progress/engine.md, or ask me if unclear). Finish with the usual phase steps: tests, progress log, commit, push, summary.
```

### Fix a bug

```text
You are Laptop A's Claude Code session on Akshi Rakshak, branch feat/engine. Read CLAUDE.md and docs/progress/engine.md. Bug: <describe what happened, the input, what you expected>. Reproduce it with a failing test first, fix it inside your owned paths, make the test pass, run all tests, update the progress log, commit and push.
```

### Merge main into my branch

```text
You are Laptop A's Claude Code session on Akshi Rakshak, branch feat/engine. git fetch, then merge origin/main into feat/engine. On a package-lock.json conflict, take main's version, run npm install. Resolve any other conflicts only inside your owned paths; if a conflict is in another laptop's path, take main's version. Run typecheck and tests, fix what is yours, commit, push, and summarise what changed.
```

### Contract change (protocol SPEC.md §9.4)

```text
You are Laptop A's Claude Code session on Akshi Rakshak. Another laptop requested a contract change: <paste the request>. Read SPEC.md §6 and §9.4. Make the change in packages/contracts on a new branch contract/<short-name> from main, update fixtures and schema tests, keep it additive if possible, run all tests, push, open a PR to main and print the link. Then tell me what B and C must do after it merges (merge main into their branches).
```
