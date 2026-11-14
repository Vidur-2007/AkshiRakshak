# Progress — web

## Done

### Phase 0 — scaffold, tokens, shell (14 Nov 2026)

- `apps/web` is the `@akshi/web` workspace: Vite 8, React 19, React Router 8 (data router), Tailwind CSS v4 (`@tailwindcss/vite`), shadcn/ui (`components.json`, new-york style; primitives in `components/ui/` restyled to our tokens: button, switch, dropdown-menu, sheet, command, sonner), lucide-react, sonner, cmdk, Motion for React, i18next + react-i18next, Dexie, Zustand, zod.
- `vite.config.ts`: copies `packages/engine/assets/**` to `dist/engine-assets/` (checked: `engine-assets/README.md` lands there); `/api` proxies to `http://localhost:3001`; `manualChunks` for three / @react-three, recharts, react-force-graph, tesseract.js and the model JSON; `@/` alias.
- Scripts: `dev` (vite, port 5173), `build` (`tsc -b && vite build`), `typecheck`, `test`. Root `npm run dev` and `npm run build` pick them up.
- `styles/tokens.css`: every §3.1 token (surfaces, glass, text, brand, ai, the three risk colours, glow, radii 12/16/24, 4px spacing, type scale 14/16/20/28/40 + hero clamp), plus the Elder (`html.elder`: 20px base, 56px taps, solid glass) and low-tier (`html.tier-low`: no blur) overrides. `globals.css` maps tokens into Tailwind and the shadcn variable names. `fonts.css`: Geist Sans and Geist Mono, Noto Sans Devanagari, Telugu and Bengali via Fontsource, applied per `:lang()`, with line height 1.4 Latin and 1.6 Indic.
- `lib/`: `engine.ts` (the only `@akshi/*` importer; OCR is a lazy wrapper so tesseract stays out of the first load), `motion.ts` (§3.3 tokens, page/sheet/fade variants), `deviceTier.ts` (§3.4 rules + per-tier settings), `store.ts` (Zustand, persisted prefs through a storage wrapper that never throws, values checked when read back; runtime `deviceTier`, `online`, `lastResultId`; `?simple=1` and `?lang=` flags), `db.ts` (Dexie `akshi` with `scans`, `blocklist`, `statements`, `dojo`; `saveScan` broadcasts; `blocklistValues`; `deleteEverything`), `broadcast.ts` (`BroadcastChannel('akshi')`, messages checked with zod), `i18n.ts`, `risk.ts`, `langs.ts`.
- Locales `en`, `hi`, `te`, `bn` with real translations in plain everyday words. Non-English files start with `"_review": "pending"`.
- App shell: desktop glass top bar (≥ 1024px) with Scan, Modules menu, Dashboard, Network, Learn menu, palette button, language switcher (EN / हि / తె / বা), Elder toggle and the red "I think I'm being scammed" pill (shows "SOS" between 1024 and 1280px). Mobile: sticky header with the SOS button pinned top-right, bottom tab bar (Home, Dashboard, raised Scan in the centre, Learn, More) and a More sheet (Modules, Learn, Network, Settings, Tour, language, Elder mode). Command palette on Ctrl/Cmd+K (routes, paste-and-scan, language, Elder mode). Offline pill. Skip link. `LazyMotion` + `MotionConfig reducedMotion="user"`, and `AnimatePresence mode="wait"` page transitions keyed by pathname. `ScrollRestoration` resets scroll to the top except on back/forward.
- Every §4.1 route exists as a lazy page with a placeholder that uses the shell. The landing page already runs `scoreLive` in a simple meter, `/scan` calls `warmup()` and shows palette/share-target prefill, `/sos` has a `tel:1930` button, and `/settings` has the language and Elder controls.
- Tests (51 in `apps/web`): device tier, store (defaults, Elder → voice, URL flags, sanitising), safe storage, broadcast, db helpers, risk helpers, locale parity (same keys, `_review` first, no empty strings, placeholders kept, never "safe"), `UI_LANGS` matches the contract `LANGS`, and every route renders inside the shell.
- Bundle: the first load is **191 KB gzipped JS** (budget 200 KB). The palette (cmdk), sonner and Motion features (33 KB) load lazily. The engine stub chunk is 47 KB gzipped and loads with the first page that uses the engine.

### Phase 1 — Quick Scan and the Analysis screen (14 Nov 2026)

- **Quick Scan (`/scan`)**: an auto-growing glass input (Ctrl/Cmd+Enter scans, 20,000-character cap with a note); a TypeDetectChip that morphs between Message, Chat, Email, Link, UPI ID, Phone and QR as you type (`detectInputKind`); Paste (Clipboard API, "Long-press and paste" hint when the browser says no); Upload screenshot and Scan QR open a "coming in the next build" sheet until Phase 2; a full-page DropZone (text files and dragged text fill the input, images open the screenshot sheet); sample chips from `SAMPLE_MESSAGES` labelled "Sample data" (a click fills the input and scans); the AI second opinion toggle (off by default, masked-text note, disabled offline); a Scan button whose ring fills with stage progress; a StageTicker fed by `onStage` that shows skipped stages (model, AI) as skipped; `warmup()` on mount; palette "Paste and scan" and share-target prefill with auto-scan.
- **Scan flow** (`components/scan/useScan.ts`): blocklist from Dexie goes into `options.blocklist`, the request carries the UI language, the ticker stays up for at least 400 ms and never longer (`lib/scanTiming.ts`), and a newer scan aborts the older one. The result goes to Dexie (`saveScan` broadcasts `{ type: 'scan', id }`) and to an in-memory copy, so the Analysis screen opens even when IndexedDB is blocked. Then we navigate to `/scan/:id` with `{ fresh: true }`.
- **Analysis (`/scan/:id`)**: loads from memory or Dexie; "not on this device" state with a New scan button. The input card and the message panel share `layoutId="scan-card"`, and right after a scan the incoming page skips its fade so the morph carries the transition. The §5.3 reveal timings live in `components/analysis/reveal.tsx` (gauge 150 ms, verdict, chips and background glow 400 ms, underlines from 600 ms strongest first 80 ms apart, reasons 900 ms, dock 1100 ms with one 30 ms vibration and a STOP-icon pulse on a scam). With reduced motion (through `MotionConfig`) or Elder mode, everything appears at once and numbers don't count up. A visually hidden `aria-live="assertive"` region announces "Scam. Risk 72 out of 100. Fake KYC update." in the UI language.
- **Components** (`components/analysis/`): VerdictHeader (RiskGauge 240° SVG arc with ticks at 40 and 70 and a mono count-up, verdict word plus icon, SeverityChip, CategoryChip with a per-category icon and `categoryText`, ConfidenceRing, explanation); HighlightedText (inline underlines drawn with an animated background so long phrases wrap; overlapping spans merge into one keyboard-focusable control whose popover lists every signal; AI spans use `--ai`); ReasonList (weight bars; negative-weight signals last, in green, as "Reassuring: …"); ClaimVsRealityCard (hidden when empty); EntityChips (mono, risk dots with screen-reader text; links and UPI IDs open `/modules/qr-link?value=…`); LayerBreakdownBar (brand shades and `--ai`, not risk colours; unavailable layers say off / offline / not used); WhatToDo (every action with its body and link); ActionDock (first two actions, each opening a sheet with `actionText` body and link, plus Reject/Block, Report, Copy evidence, Warn family and SOS); PrivacyFooter; Read aloud (`lib/speech.ts`, voice chosen by UI language with English fallback; auto-reads after a fresh scan when `voiceAuto` is on).
  - Reject/Block sheet: decline steps, an honest note that we cannot block inside UPI or SMS apps, and "Add to my blocklist" for the UPI IDs, phones and non-official domains found.
  - Report sheet: 1930 (`tel:`), cybercrime.gov.in, Chakshu on Sanchar Saathi (attempts with no money lost), plus the evidence block with a copy button.
  - Copy evidence: plain text with date and time, verdict, risk, category, phones, UPI IDs, links, emails, amounts, reasons and the message (`lib/evidence.ts`).
  - Warn family (until the P4 share card): a short text in the UI language with the verdict, category, top two red flags and the first action, with no entities. It uses `navigator.share` where available, otherwise the clipboard.
- **Layout**: desktop two columns (message and details on the left, sticky; verdict, reasons, claims, actions, layers and dock on the right). Mobile is a single stack in reading order (verdict first), with the action dock fixed above the tab bar as a solid surface, so no more than two blurred layers show.
- **Strings**: every new string in en, hi, te and bn (`kind`, `severity`, `stageStatus`, `scan`, `analysis`, `evidence`, `stage`).
- **Bundle**: only English ships in the first load. hi/te/bn are about 5 KB chunks: the stored language loads before first render, so there's no English flash, and the others prefetch at idle. First load **189 KB gzipped**; ScanPage chunk 5.5 KB, AnalysisPage 12.6 KB.
- **Tests** (86 in `apps/web`, 153 in the repo): span merging and segments, RiskGauge arc maths, StageTicker minimum duration (`withMinDuration` with a fake clock), ticker state and progress, `pickVoice`, evidence text and blockable values, `buildRequest` per kind (AI never requested offline, 20k cap), HighlightedText rendering (merged controls, popover lists every signal, Enter opens it), ReasonList order, RiskGauge label and ticks, StageTicker statuses, and two full Quick Scan → Analysis flows through the real router (fake KYC → Scam with highlights, actions and the announcement; genuine OTP → "No warning signs found", and "safe" never appears).

## In progress

- Nothing. Phase 2 (QR & link, collect request + PIN pad, messages/chat, screenshot flow) is next.

### Notes from A's Phase 1 (on feat/engine, not yet on main)

- `stageText(stage, lang)` is new. `lib/engine.ts` already exports `stageText`: it uses the engine's version when present, and otherwise falls back to our `stage.*` locale strings (en/hi/te/bn). After Merge 1, replace the fallback with a plain re-export (marked `TODO(M1)`).
- The real engine returns empty `claimVsReality` and `entities.brands` until A's P2, and the `model`/`ai` stages report `skipped`. In Phase 1, ClaimVsRealityCard must hide itself when the list is empty, the StageTicker must show skipped stages as skipped (not done), and LayerBreakdownBar must grey out unavailable layers.
- Labels and explanations come back in the requested `lang`; pass the UI language to every `analyze` call.
- Fixtures still drive the stubs on main, so Phase 1 screens are built against fixtures and checked against real results after Merge 1.

## Deferred

- vite-plugin-pwa and the manifest/share target: Phase 4, as SPEC_B_WEB §2.1 says.
- `playwright.config.ts` and e2e specs: Phase 5. CI's e2e job skips until the config exists.
- `lib/share.ts` (image share cards) and `styles/print.css`: P4 share cards, P3 complaint draft.
- Screenshot upload and Scan QR on Quick Scan open a placeholder sheet until Phase 2. `/modules/qr-link?value=` is already linked from entity chips; the page reads it in Phase 2.
- Elder mode's simplified Quick Scan and full-screen verdict: Phase 3 (M10.1). Today Elder mode only turns the reveal choreography off and enlarges text.
- shadcn components beyond the five primitives are added as screens need them, using `components.json`.

## Known issues

- On feat/engine the fake KYC sample scores 47 (**Suspicious**). The demo opening (SPEC.md §13.1) and Playwright test 2 (SPEC_B_WEB §8) expect **Scam**. See Request 3.

- `/scan` loads about 249 KB gzipped (189 KB shell + 5.5 KB page + 54 KB engine stub), which is over the 200 KB budget. Most of the stub's weight is `@akshi/contracts/fixtures`, which parses every fixture with zod when the module loads. See Request 2.
- The root `npm run typecheck` does not cover `apps/web` yet (see Request 1). `npm run build -w @akshi/web` runs `tsc -b` on the web project, so type errors still fail the build and CI's build step.
- Not checked in a real browser: this session had no browser, so the reveal timings, the shared-element morph, the popovers and the mobile dock are covered by jsdom tests and code review only. Check on a phone and a laptop before the demo recording.
- The shared-element morph runs after the Quick Scan page finishes its 250 ms exit (`AnimatePresence mode="wait"`), so the card moves from where it was during the exit. If it looks off in the browser, switch that pair to `mode="popLayout"`.
- Font files (all scripts, 400/500/600/700) are emitted but only fetched when a glyph in their unicode-range is shown.

## Requests

1. **Laptop A — root `tsconfig.json`:** add `{ "path": "apps/web" }` to `references` so `npm run typecheck` covers the web app. `apps/web/tsconfig.json` is a solution file, and its two projects are composite and emit to `.tsbuild/web/` (already gitignored).
2. **Laptop A — engine bundle size:** please keep `@akshi/contracts/fixtures` out of the real engine (the Phase 0 stub imports it), and add `"sideEffects": false` to `packages/{contracts,engine,content,insights,model}/package.json` if the modules allow it, so the web bundler can drop unused exports. Goal: the engine chunk fits inside `/scan`'s 200 KB budget together with the 189 KB shell, or we agree to load the engine after first paint.
3. **Laptop A / Laptop C — fake KYC sample verdict:** A's log shows `SAMPLE_MESSAGES` fake KYC at 47 (suspicious). The demo and the e2e test both open with it as a clear Scam. Please tune the rules or the sample (or tell B to change the test) before M1.
