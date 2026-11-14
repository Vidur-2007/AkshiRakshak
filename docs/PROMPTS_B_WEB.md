# Prompts — Laptop B (web app, UI and experience)

Paste one prompt at a time into Claude Code, from the repo root. Start each phase in a fresh session (`/clear`); every prompt makes Claude re-read the specs and your progress log. Wait for the phase summary before moving on. If Claude Code stops part-way, use the "Resume" prompt at the end.

## Before Phase 0 (human)

1. Install Node.js 22 LTS or newer, Git, Claude Code; sign in with Laptop B's Claude account. Accept the GitHub collaborator invite from the team lead.
2. While Laptop A builds the skeleton (~45 minutes): read `docs/SPEC.md` §1–§3 and `docs/SPEC_B_WEB.md` (A will have shared the seven files), and collect test material: 5–10 screenshots of **fake** scam messages you type yourself into a notes app or a chat with a teammate, in English, Hindi and Telugu (never real people's numbers). These are for OCR testing.
3. When A says "Skeleton is on main": `git clone`, then `git checkout -b feat/web`, `npm install`, run `claude`, paste Phase 0.
4. Keep a mid-range Android phone nearby for testing from Phase 2 onward (open the Vercel preview URL or your laptop's LAN address).

---

## Phase 0 — Scaffold, tokens, shell (Day 1)

```text
You are Laptop B's Claude Code session for the Akshi Rakshak hackathon project. You own the web app (apps/web) and nothing else. Branch: feat/web.

Read docs/SPEC.md completely, then docs/SPEC_B_WEB.md completely, then docs/progress/web.md. Read SPEC.md §6 (contracts) carefully: you will build against these types and the package APIs, which are stubs returning fixture-shaped data until Merge 1.

Goal: a running, deployable app skeleton with the design system and app shell.

Build, following SPEC_B_WEB.md §2–§4:
1. apps/web as a Vite + React + TypeScript workspace package named @akshi/web, with React Router, Tailwind CSS v4, shadcn/ui initialised (then restyled to our tokens), lucide-react, sonner, cmdk, Motion for React, i18next + react-i18next, Dexie, Zustand.
2. vite.config.ts: static copy of ../../packages/engine/assets/** to /engine-assets/, /api proxy to http://localhost:3001, manual chunks for heavy libraries. Add a "dev" and "build" script so root npm run dev and npm run build work.
3. styles/tokens.css with every token from §3.1; globals.css; Geist Sans and Geist Mono plus Noto Sans Devanagari, Telugu and Bengali via Fontsource, applied per :lang(); line heights per §3.2.
4. lib/motion.ts (§3.3), lib/deviceTier.ts (§3.4), lib/store.ts and lib/db.ts (§2.3), lib/broadcast.ts, lib/i18n.ts with locales en, hi, te, bn (non-English files start with "_review": "pending"; write real translations, plain everyday words).
5. lib/engine.ts as the single import surface (§2.2).
6. App shell (§4): desktop glass top bar with Modules and Learn menus, language switcher, Elder toggle, red "I think I'm being scammed" pill; mobile bottom tab bar with raised Scan button and pinned SOS button; command palette (Ctrl/Cmd+K); offline pill; MotionConfig reducedMotion="user"; AnimatePresence page transitions.
7. Every route from §4.1 exists with a placeholder page that uses the shell, so navigation works end to end.
8. Make sure npm run build -w @akshi/web passes and produces apps/web/dist.

Rules: only edit apps/web and docs/progress/web.md. Import @akshi/* only inside src/lib/engine.ts. Never write "safe" as a verdict.

Finish: npm run typecheck && npm test && npm run build -w @akshi/web; update docs/progress/web.md (Done, In progress, Deferred, Known issues, Requests); commit with conventional messages; push feat/web; print a short summary for the human with how to open it (npm run dev, URL) and the Vercel preview URL if one appears.
```

---

## Phase 1 — Quick Scan and the Analysis screen (Day 1)

```text
You are Laptop B's Claude Code session on Akshi Rakshak. Branch: feat/web. Read docs/SPEC.md, docs/SPEC_B_WEB.md and docs/progress/web.md first. Work only inside apps/web.

Goal: the two most important screens, finished to demo quality, running on the stub engine (fixture-shaped results with real spans over your input).

Build, following SPEC_B_WEB.md §5.2 and §5.3:
1. Quick Scan (/scan): auto-growing glass input; TypeDetectChip using detectInputKind; Paste, Upload screenshot, Scan QR buttons (screenshot and QR can open placeholders until Phase 2); full-page DropZone; sample chips from SAMPLE_MESSAGES; AI second opinion toggle with the masked-text note (disabled offline); Scan button with filling ring; StageTicker driven by onStage with the 400 ms minimum and nothing longer; warmup() on mount; save to Dexie, broadcast, navigate to /scan/:id.
2. Analysis (/scan/:id): load from Dexie; shared layoutId "scan-card" transition; the full reveal choreography table in §5.3 with timings; reduced-motion path; aria-live announcement.
3. Components: VerdictHeader (RiskGauge SVG arc with ticks at 40 and 70, verdict word, SeverityChip, ConfidenceRing, CategoryChip using categoryText), HighlightedText with SignalPopover and overlapping-span merging, ReasonList (negative signals last in green), ClaimVsRealityCard, EntityChips (mono, risk dots), LayerBreakdownBar, ActionDock (actions from result.actions via actionText, plus Reject/Block, Report, Copy evidence, Warn family placeholder, SOS), PrivacyFooter, Read aloud button (lib/speech.ts).
4. Desktop two-column and mobile stacked layouts with the fixed action dock on mobile.
5. Vitest tests: HighlightedText span merging, RiskGauge arc maths, StageTicker minimum duration.

Quality bar: this screen is the centre of the demo video. Make spacing, type and motion feel finished. Respect the design rules in §3 (risk colours only for risk, glow only for verdict/shield).

Finish: typecheck, tests, build; update docs/progress/web.md; commit; push feat/web; print a summary with what to click to see the reveal.
```

---

## Phase 2 — Modules, screenshots, actions (Day 2 morning)

```text
You are Laptop B's Claude Code session on Akshi Rakshak. Branch: feat/web. Read docs/SPEC.md, docs/SPEC_B_WEB.md and docs/progress/web.md first. Work only inside apps/web.

Build, following SPEC_B_WEB.md §5.4–§5.7 and the action sheets in §5.3:
1. QR & links (/modules/qr-link): QRScannerSheet (getUserMedia rear camera, BarcodeDetector with qr-scanner or jsQR fallback in a worker, corner-bracket animation, torch if supported, upload alternative, permission-denied path); QRXray; URLAnatomy with the lookalike diff row; RedirectHops; DomainAgeBadge; direct input for a URL or UPI ID.
2. Collect-request guard (/modules/collect): CollectRequestMock phone frame that updates live; big toggle questions mapped to CollectRequestInput; optional screenshot upload that runs OCR and pre-fills; inline result; PinPadExplainer that plays once when RECEIVE_WITH_PIN is present, with replay.
3. Messages (/modules/messages): single message, chat, or email; ChatThreadView with per-bubble risk edge; RiskLine chart of chat[].risk; email header card with the mismatch highlighted.
4. Screenshot flow (§5.7): preview, ocrImage with progress ("this stays on your phone"), analyze with kind image, weak-OCR path with an editable text box, ScreenshotOverlay boxes in the Analysis screen, tappable like spans.
5. Actions: Reject/Block sheet with generic decline steps and "Add to my blocklist" (Dexie; pass blocklist values into every analyze call); Report sheet (tel:1930, cybercrime.gov.in, Chakshu on Sanchar Saathi with the "suspected fraud messages and calls, not completed fraud" note) with evidence to copy; Copy evidence (format in §5.3).
6. Test on a real phone via the Vercel preview URL: camera QR scan, screenshot upload, the PIN explainer.

Finish: typecheck, tests, build; update docs/progress/web.md (note anything in the stub engine you could not exercise); commit; push; print a summary.
```

---

## Phase 3 — Emergency, Elder mode, Transactions, Dashboard (Day 2) → Merge 1

```text
You are Laptop B's Claude Code session on Akshi Rakshak. Branch: feat/web. Read docs/SPEC.md, docs/SPEC_B_WEB.md and docs/progress/web.md first. Work only inside apps/web.

Build, following SPEC_B_WEB.md §5.8–§5.11 and §5.14:
1. Emergency (/sos): calm full-screen takeover; one question card at a time from EMERGENCY.questions; ordered checklist from EMERGENCY.steps (always first, matching "when" next, no_loss when all answers are No); action buttons; evidence pack from history; /sos/report printable complaint draft with styles/print.css and window.print().
2. Elder Safety Mode (§5.10): .elder class and variables, ?simple=1 handling, simplified Quick Scan, full-screen STOP / CAREFUL / No warning signs found verdicts, automatic read-aloud, Call my family (tel: link to the trusted contact from Settings).
3. Settings (/settings): language, Elder mode, AI opt-in, voice, haptics, trusted contact, privacy panel, Delete everything.
4. Transactions (/modules/transactions): CSV upload and SAMPLE_STATEMENTS cards labelled "Sample data"; parseStatementCsv + analyzeStatement; StatementChart with the normal band and pulsing anomaly dots; AnomalyCard with the feature table; anomaly list; risk score; narrative; SpendingSummary; parse errors with row numbers; saved to Dexie.
5. Dashboard (/dashboard) tabs: My shield (KPIs with count-up, RecentDetectionsFeed updating live from BroadcastChannel — test with two tabs, charts, network preview), Lookup (lookupIndicator results with labels), Scam landscape (LANDSCAPE and PATTERN_CARDS with the "Sample data" label).

Then Merge 1 (order: C, then A, then B — you are last):
- Wait until the human says A's PR has been merged into main.
- git fetch, then merge origin/main into feat/web (lockfile rule: take main's package-lock.json, npm install). Resolve conflicts only inside apps/web.
- The engine, model, insights and content packages are now real. Run the app and check Quick Scan, Analysis, QR, collect, screenshot, transactions and dashboard with real results. Fix anything in apps/web that assumed fixture-only shapes. Write Requests in docs/progress/web.md for problems in other packages.
- typecheck, tests, build. Push and open a PR feat/web → main with gh pr create if available; otherwise print the steps for the human.

Finish: update docs/progress/web.md; push; print a summary with the PR link and a list of real-engine issues you saw.
```

---

## Phase 4 — Landing, 3D, Network, Dojo, Proof, Ask, PWA (Day 3 morning)

```text
You are Laptop B's Claude Code session on Akshi Rakshak. Branch: feat/web. Read docs/SPEC.md, docs/SPEC_B_WEB.md and docs/progress/web.md first. Work only inside apps/web.

First: git fetch, merge origin/main into feat/web (lockfile rule), run typecheck and tests.

Build, following SPEC_B_WEB.md §5.1, §5.12, §5.13, §5.15, §5.16:
1. Landing (/): hero with the localised headline, LiveRiskMeter using scoreLive (rAF + 150 ms debounce) with signal chips, and ShieldCore (lazy @react-three/fiber scene: instanced-point icosphere, brand glow, typed characters become particles drifting in, amber/red ring pulses at 40/70, settles into verdict colour on Scan, pointer parallax, paused offscreen and on hidden tab, DPR cap by tier, static poster on low tier). Scan from the hero runs the real scan and navigates with the shared transition.
2. Scroll story: the seven sections in §5.1 (anatomy of a scam pinned SMS, PIN rule, tilt module cards, proof count-ups from EVAL_REPORT, offline toggle, four-language morph, CTA and footer with 1930, cybercrime.gov.in, Chakshu). Lenis on high/mid tier only.
3. Network (/network): buildEntityGraph from history with includeBundled; react-force-graph-2d lazy; node styles by type, own-entity cyan ring, sample nodes translucent; hover neighbours; EntityPanel; filters; stats line.
4. Dojo list and player (/learn/dojo, /learn/dojo/:id): WhatsApp-style player with typing dots, choice bubbles, feedback, red-flag flashes using signalText, ending screen with ScoreRing, caught/missed flags, scores in Dexie.
5. Ask (/learn/ask + slide-over from the top bar): suggested questions from FAQ, askAssistant with online only when AI opt-in and online, offline/AI badges, source links.
6. Proof (/proof): every block in §5.13 from EVAL_REPORT, including handwritten vs synthetic, ablation, per-language, per-category, confusion heatmap, latency, statements, methodology accordion.
7. Share cards (§5.15) for analysis results and Dojo endings, with masking of the scam's UPI IDs and links.
8. PWA (§2.1, §5.16): vite-plugin-pwa with precache rules (model JSON and lexicons precached, tessdata runtime CacheFirst, never /api), manifest with share_target, /share-target route.

Finish: typecheck, tests, build; check bundle sizes against §7 and list them in docs/progress/web.md; commit; push; print a summary.
```

---

## Phase 5 — Integration, languages, accessibility, performance (Day 3) → Merge 2

```text
You are Laptop B's Claude Code session on Akshi Rakshak. Branch: feat/web. Read docs/SPEC.md, docs/SPEC_B_WEB.md, docs/progress/web.md, and (read-only) docs/progress/engine.md, docs/progress/data.md and docs/i18n-review.md.

First: git fetch, merge origin/main (lockfile rule), run typecheck and tests.

Do:
1. Integration (§9): every screen with real results — long texts, many and zero signals, model unavailable, AI on/off, offline. Model chunk precached; tessdata loading from /engine-assets/ and working in airplane mode after one use. Remove fixture assumptions.
2. Languages: complete en, hi and te for every string; bn for every P0/P1 screen (fallback en elsewhere). Check that Indic text never clips (line heights, buttons, chips) at 360 px width. Apply reviewer corrections listed in docs/i18n-review.md for apps/web.
3. Accessibility (§6): keyboard path through Quick Scan → Analysis → actions; focus rings; aria-live verdicts; gauge labels; icon + word for every risk; 200% text zoom; Elder mode tap targets. Fix everything you find.
4. Performance (§7): measure /scan initial JS (gzipped), Lighthouse mobile on /scan and /, LCP on landing; lazy-load anything heavy that leaked into the main chunk; cap blur layers; confirm ShieldCore pauses offscreen. Record numbers in docs/progress/web.md.
5. Real devices: mid-range Android in Chrome, a laptop in Chrome and in Edge. Fix layout and interaction issues.
6. Playwright (§8): all ten smoke tests across the three projects; they must pass locally and against the Vercel preview URL (BASE_URL env).

Merge 2 (order C, A, then you): after A's PR is merged, merge origin/main again, rerun everything, push, open PR feat/web → main.

Finish: update docs/progress/web.md with measured numbers and remaining issues; push; print a summary with the PR link.
```

---

## Phase 6 — Judge tour, polish, demo recording (Day 4)

```text
You are Laptop B's Claude Code session on Akshi Rakshak. Branch: feat/web. Read docs/SPEC.md, docs/SPEC_B_WEB.md, docs/progress/web.md and docs/demo-script.md (read-only). Code freeze is at midday: after that, only fixes in small PRs.

First: merge origin/main; run typecheck, tests, build.

Do:
1. Judge tour (/tour, §5.17): scripted steps with coach marks and progress, Next/Skip, bundled samples only, works offline. Link it from the landing hero.
2. Polish pass on the screens in the demo script, in its order: landing hero, Quick Scan → Analysis reveal, collect + PIN explainer, QR x-ray + URL anatomy, Telugu screenshot, statement anomalies, Elder STOP with Hindi voice, offline scan, Proof, Emergency. Fix any visual glitch, jank or unclear copy.
3. If time remains before freeze, P2 items in this order: M9.2 (3D network toggle on desktop high tier), M1.15 (live listen with SpeechRecognition interim results and the engine helper from Laptop A), M11.6 (personal tips).
4. Prepare for recording: a ?demo=1 flag that clears history to a clean state and puts the samples used in the script at the front of the sample chips. It must not change any verdict or score.

Finish: typecheck, tests, build; update docs/progress/web.md; commit; push; open a small PR; print a summary with the recording checklist (screen size, browser zoom 100%, notifications off, airplane-mode step).
```

---

## Utility prompts

### Resume after an interruption

```text
You are Laptop B's Claude Code session on Akshi Rakshak, branch feat/web. A previous session was interrupted. Read CLAUDE.md, docs/SPEC.md, docs/SPEC_B_WEB.md and docs/progress/web.md. Run git status and git log -10 to see where work stopped. Continue the current phase from where it stopped (ask me which phase if unclear). Finish with the usual steps: typecheck, tests, build, progress log, commit, push, summary.
```

### Fix a UI bug

```text
You are Laptop B's Claude Code session on Akshi Rakshak, branch feat/web. Read CLAUDE.md and docs/progress/web.md. Bug: <screen, device/browser, what you did, what happened, what you expected>. Reproduce it (add a Vitest or Playwright test when it is logic or flow), fix it inside apps/web, run typecheck/tests/build, update the progress log, commit and push. If the cause is in another package, write a Request in docs/progress/web.md instead of editing it.
```

### Merge main into my branch

```text
You are Laptop B's Claude Code session on Akshi Rakshak, branch feat/web. git fetch, then merge origin/main into feat/web. On a package-lock.json conflict take main's version and run npm install. Resolve other conflicts only inside apps/web; for any other path take main's version. Run typecheck, tests and build, fix what is yours, commit, push, and summarise what changed.
```

### Design review of one screen

```text
You are Laptop B's Claude Code session on Akshi Rakshak, branch feat/web. Review the <route> screen against docs/SPEC_B_WEB.md §3 (design rules, tokens, motion) and §6 (accessibility) at 360 px, 768 px and 1440 px, in English and Telugu, with reduced motion on and off. List every deviation, then fix them inside apps/web, commit and push.
```
