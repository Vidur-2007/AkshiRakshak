# Progress — web

Since 2026-11-20 the web app is maintained in the single session on `feat/engine` (see CLAUDE.md). Laptop B no longer edits `apps/web/`.

## Done

### Scam Replay on the Analysis screen (21 Nov 2026)

- A "Scam replay" card (`components/analysis/ScamReplay.tsx`, logic in `lib/replay.ts`) plays the attack a message sets up as a timeline.
  - Steps: the bait → the pressure → the trap → the demand. Each step shows the engine's step text, the words of the message behind it (from the signal spans), and the tricks it uses (fear, artificial urgency, authority pressure, …).
  - A cyan shield marks where Akshi's warning comes in: before the first step that asks you to act (open a link or app, share a code, pay). The steps after it have dashed outlines.
  - The last row is "What they want next": your money, OTP or PIN; or you on a page or app they control.
- **Built only from evidence:** steps come from `attackStory` and `manipulationTactics` (engine, PR #7), and every quote is a slice of the message. The card is shown only with warning signs and at least two stages.
- **Animation:** plays once when scrolled into view, about 0.85 s per step; Replay plays it again. Reduced motion and Elder mode show every step at once, with no Replay button. Rows still to come are `visibility: hidden`, so screen readers and axe skip them until shown.
- Strings in en/hi/te/bn (`replay.*`); the hi/te/bn strings are mine, for the i18n review.
- Tests: `lib/replay.test.ts` (7, on the real engine incl. Hindi) and `ScamReplay.test.tsx` (3: order and shield position, Replay, Elder mode). 50/50 e2e in Edge.
- `scanFlow.test.tsx`: the flow test now has a 15 s budget, and the ticker wait 4 s. On this laptop the first scan, including the engine load, takes about 4 s, past vitest's 5 s per-test default once rendering is added. It failed the same way without this change. This was the "known flake".

### Cosmic intro, landing details, cosmic network (21 Nov 2026)

From the human's second design file (index.html with a Three.js intro and rise.js) and a "cosmic web" reference image.

- **Opening intro** (`components/home/CosmicIntro.tsx`, `lib/cosmic.ts`):
  - A scroll-driven point cloud that opens straight away (the human asked for no loading counter), with a HUD, Skip, a progress bar and three captions:
    1. messages flood in as a cosmic web (cyan filaments between glowing purple hubs);
    2. a few turn red ("traps");
    3. the traps are pushed away and the rest settle into the shield-eye, then the camera flies in.
  - **Raw WebGL, no three.js**, to stay under the 100 KB dependency rule. Points: 9,000 on high-tier desktop, 5,500 otherwise, 3,200 on phones.
  - **When it plays:** once per browser session. It never plays with reduced motion, under automation (`navigator.webdriver`), with `?demo`, `?simple` or `start=` links, or without WebGL. When it plays, the short AKSHI loader is skipped.
  - **Exits:** Skip, Esc, or scrolling to the end.
  - **Bug fixed during review:** the effect cleanup called `loseContext()`, so StrictMode's second effect run got a dead context and the intro closed itself at once. GL resources are now freed with `dispose()`.
- **Hero callouts** (`.ann`): in Akshi view, four dashed callouts point at the sample SMS. They read Fake deadline, Look-alike link, KYC by SMS and Personal number. Hidden on phones.
- **"How Akshi decides"** panel in the shield moment: five steps (message → rules → on-device model → link check → verdict chips). Hidden on short or narrow screens.
- **Rising headings** (`RiseText`): letters rise in once on screen. Indic scripts rise word by word, so conjuncts stay intact. Screen readers get the plain text. Reduced motion and Elder mode show the text at once.
- **Deck fly-in:** the first time the deck is on screen, the cards fly up from below, staggered, then autoplay (3.2 s) starts.
  - Bug fixed during review: the 1.7 s flight timer lived in an effect that re-ran when `arrival` changed, so autoplay never started. It is now its own effect. The e2e perf test waits for the flight.
- **Network "cosmic connections"** (`ForceGraphView.tsx`): always a dark space, in both themes.
  - Campaigns are purple glowing hubs. Phone numbers, UPI IDs and websites are cyan sparks; the shapes still tell the type.
  - Links are glowing filaments with sparks travelling along them, using additive light.
  - A faint seeded web backdrop (decoration, drawn once to an offscreen canvas) with twinkling stars.
  - The layout is looser so filaments read as lines. The legend swatches match the new palette.
- Strings: the `intro.*` group and new `home.ann*` / `home.flow*` keys in en/hi/te/bn. The hi/te/bn strings are my translations, for the i18n review.
- Checked:
  - Edge screenshots of the intro at 0/10/38/70/90%, the landing on desktop and phone, and the network.
  - `cosmic.test.ts` (6 tests).
  - All 50 e2e tests in Edge, including axe in both themes.

### Redesign to the human's design file (20 Nov 2026)

The design: "Akshi Rakshak — Scam shield". Cool paper by day, near-black by night, cyan for Akshi, red only for danger. Instrument Serif headings with Inter Tight text, and Space Grotesk / Space Mono for the cards and numbers. Liquid-glass pills.

**Foundation (every page)**

- **Two themes:** `tokens.css` has a night and a day token set on `<html data-theme>`.
  - The preference is follow the phone (default), day or night. It's set in the store and applied before first paint by `index.html`.
  - Switches: a day/night switch in the top bar, a switch in the More sheet on phones, and a three-way choice in Settings.
  - Strings in en, hi, te and bn.
- **Contrast in both themes:**
  - Day text `#10161d` / `#545f6c`.
  - Day `--brand` is `#006a80`, because bright cyan can't be text on paper. The bright cyan stays for glows and fills.
  - Day risk colours: scam `#c8193c`, suspicious `#9a5200`, no signs `#137337`.
  - White hover tints became a theme-aware `overlay` colour.
- **Buttons are pills:** ink for the main action, a new `cyan` variant, and glass for outline/secondary.
- **Headings:** the serif at weight 400. All-caps labels stay sans and spaced (the design's eyebrow).
- **Top bar:** the design's three columns (links | serif wordmark | tools, SOS). The SOS pill shows "SOS" below 1536 px so everything fits.
- **Fonts:** self-hosted via Fontsource, so they work offline. Geist was removed.

**Landing (`/`)**: three full-screen moments that snap one at a time with normal scrolling (CSS scroll-snap; no wheel hijacking), with section dots.

1. **Phone x-ray:**
   - The bundled fake-KYC sample is analysed by the real engine. Akshi view shows its real highlights and score (Scam 95).
   - The Normal / Akshi view switch is from the design.
   - "Check a message" opens the real paste box with the live meter. Scan morphs into the result.
2. **Shield eye:** lights up with a flicker the first time it's seen, or on tap.
3. **Scam deck:**
   - 19 cards, one per scam category, using the engine's translated names and one-liners. Each card has two warning-sign tags.
   - Flick, drag, arrows and arrow keys all work. It autoplays only while on screen.
   - The "Shield on" switch turns every card to "Caught".
   - Help links underneath: 1930, cybercrime.gov.in, Chakshu.

- **Loader:** the "AKSHI" loader plays on the first visit only. It's skipped with reduced motion, in Elder mode, with `?demo` / `?simple` / tour links, and under automation.
- **Top bar:** turns dark over the dark moments.
- **Copy changed for the truth rules (§1.3):**
  - "a safe look at every link" → "a careful look".
  - "nothing leaves your phone" → "Text checks run on your phone, even offline", because link expansion and the optional AI do go online.
  - "Blocked" → "Caught", because the app can't block anything.
- **Removed:** ShieldCore, ShieldPoster, Story, `shieldMath.ts`, `lenis`.

**Tests**

- Landing unit tests rewritten. Browser smoke test 1 now opens the check first.
- The performance test now checks that the deck only moves while on screen. The canvas test is gone.
- The axe check runs on every page in **both themes**.
- Results on this laptop: 36/36 accessibility checks pass in day and night. The full browser suite passes through Edge.

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

### Phase 2 — QR & links, collect guard, messages, screenshots (14 Nov 2026)

- **QR & links (`/modules/qr-link`)**: one input for a link, UPI ID or `upi://` text; three samples labelled "Sample data" (lookalike link, refund QR, bank website); `?value=` from entity chips pre-fills and runs the check. Results show inline (verdict, reasons, actions, dock) with:
  - **QRScannerSheet**: rear camera via `getUserMedia`; `BarcodeDetector` when it supports QR, otherwise jsQR in a Web Worker (frames downscaled to 720 px, every 180 ms); corner brackets that close in once (no loop, §3.3); torch toggle when the track reports `torch`; "Upload QR image" always available; denied, no-camera and unsupported each get their own message and point to upload. The camera stops when the sheet closes.
  - **QRXray**: payee, UPI ID (mono) with its app (only well-known handles: PhonePe, Google Pay, Paytm, Amazon Pay, BHIM; otherwise the handle itself), prefilled-amount badge, note, a "QR opens a website" banner, the raw contents, and "You never scan a QR to receive money".
  - **URLAnatomy**: scheme, ignored text before `@`, subdomain, real website, port, path and query as labelled parts; a character-by-character lookalike row against `lookalikeOf` with `lookalikeDiff` marked; notes for IP hosts, punycode, http and the `@` trick, and an "official domain" note.
  - **RedirectHops** (status per hop, final domain emphasised) and **DomainAgeBadge** (red under 30 days, amber under 90, "Age unavailable" on error).
- **Collect-request guard (`/modules/collect`)**: requester name, UPI ID, amount (Indian formats) and note, plus four big toggle questions (accessible radio groups with arrow keys) mapped to `CollectRequestInput`; unanswered questions count as "not sure". **CollectRequestMock** redraws a generic phone frame live. "Fill from a screenshot" runs on-device OCR and fills UPI ID, amount and note from the engine's entities. The result shows inline. **PinPadExplainer**: four keys light up one by one while ₹ coins move from an illustrative balance to the requester. It ends on "Entering your PIN sends money. You never need a PIN to receive.", has a replay button, and shows the final state at once under reduced motion.
- **Messages (`/modules/messages`)**: Auto / Message / Chat / Email choice (Auto prefers email headers, because the engine's detector reads header lines as a chat); upload screenshot. Chats get a **RiskLine** (SVG, threshold lines at 40/70, escalation marker) and a **ChatThreadView** (them left, me right, a risk-coloured edge per bubble, WhatsApp prefixes stripped, "Risk rises here" chip). Emails get an **EmailHeaderCard** (From / Reply-To / Subject, the Reply-To row highlighted when its registrable domain differs).
- **Screenshot flow (§5.7)**, shared by Quick Scan (button and drop zone), Messages and the collect guard: preview, `ocrImage(blob, [uiLang, 'en'])` with a progress bar and "this stays on your phone"; a weak read (confidence < 60 or fewer than 12 letters) gets "Hard to read. Type the message instead?" with an editable box pre-filled. Images over 15 MB and non-images are refused. A good read is analysed as `kind: 'image'` with the OCR result.
- **Screenshots in history**: Dexie schema v2 adds `images` (scan id → Blob), with an in-memory fallback. On `/scan/:id`, **ScreenshotOverlay** replaces the text panel: boxes over flagged words, strongest first on the 600 ms underline clock, each tappable with the same popover as spans. When the image is not on this device, the plain text panel shows.
- **Analysis screen additions**: QRXray for QR results, URLAnatomy (+ age, hops) for link results, and the chat risk line and thread for chat results. The left column is sticky only when it is short. The empty "Details found" card is gone.
- **Actions**: every screen now goes through `runAnalysis()` in `lib/scan.ts`, which adds the UI language, AI opt-in (online only), link extras when online and **the Dexie blocklist** to every `analyze` call. The Reject/Block, Report and Copy evidence sheets from Phase 1 are unchanged, except that the Chakshu line now reads "For suspected fraud calls and messages, not completed fraud. If money was lost, call 1930." in all four languages.
- **Dependency**: `jsqr@1.4.0` (Apache-2.0), used only inside the QR worker chunk (46 KB gzipped). It loads only when `BarcodeDetector` is missing.
- **Bundle**: first load 191 KB gzipped. Page chunks: QrLink 2.3 KB, Collect 4.4 KB, Messages 1.7 KB, Scan 4.4 KB, Analysis 7.1 KB.
- **Tests** (133 in `apps/web`, 200 in the repo): URL parts (Indian second-level domains, engine domain only when it is a real suffix, IP, punycode, `@` trick, broken punycode rejected), lookalike rows, chat bubbles and escalation, email headers and Reply-To mismatch (`bank.in` is a registry zone), collect mapping, amounts and pre-fill, PIN trigger, weak OCR, image limits, QR frame sizing, camera error kinds, plus components (QRXray, URLAnatomy with lookalike diff, RedirectHops, DomainAgeBadge, PinPadExplainer, chat thread, risk line, email card, ScreenshotOverlay with popovers) and flows through the real router (Refund QR sample → x-ray with UPI ID; `?value=` link → anatomy; collect form → live mock → PIN explainer when "they said I will receive"; no explainer for a known person; chat → risk line and thread; email → header card mismatch; screenshot upload → OCR → `/scan/:id` with the screenshot; non-image refused).

### Not exercised with the stub engine (check after Merge 1)

- **EVAL_REPORT** is the Phase 0 placeholder (its notes say PLACEHOLDER). The Proof page and the landing proof numbers show a "Sample data · Placeholder numbers" banner until C's real report replaces it. **Do not record the demo with placeholder numbers.**
- **Assistant**: the stub `askAssistant` matches FAQ items by word overlap, so "what should I do if I shared my OTP" returned the digital-arrest answer. The online path (`/api/ask`) was never called.
- **Drills**: only 2 stub drills (en/hi/te and en/hi). Bengali and the 6-drill P0 count come from C.
- **No model JSON** exists yet (`loadModel()` returns null), so the precache "model JSON" rule is untested in practice. It's a `*.js` chunk once C's model lands.

- **Statements**: the stub parser accepts only the canonical CSV and returns a single error with no row number ("Only the canonical CSV format is supported by the stub"). Row-number display (`parseErrorRow`) is tested with a synthetic message only. `analyzeStatement` returns fixture-like anomalies and an English narrative whatever `lang` is.
- **Graph**: `buildEntityGraph` returns the bundled sample graph (11 nodes, 3 clusters) and ignores history. The dashboard's network preview doesn't yet reflect the user's own checks.

- `RECEIVE_WITH_PIN` never appears in stub results, so the PIN explainer also plays whenever the user answers "Yes, they said I will receive money" (that is the trap itself; `shouldExplainPin` in `lib/collect.ts`). A test covers the signal path with a synthetic result.
- `inspectUrl` in the stub returns no `lookalikeOf`/`lookalikeDiff`, `expanded` or `domainAge`, and its host parsing breaks on punycode (host = the whole URL). URLAnatomy splits URLs itself and only trusts the engine's registrable domain when it is a real suffix of the host. The lookalike row, RedirectHops and DomainAgeBadge are tested with synthetic findings only. `/api/expand` and `/api/domain-age` were never called (no network extras in the stub, and the dev API was not running).
- Stub OCR ignores the image and always returns the Telugu electricity-bill fixture with confidence 87, so the weak-OCR path is tested only through `isWeakOcr`. The stub's image boxes carry no `signalIds` (Telugu text gets no keyword hits), so on the stub the overlay shows "No words in the screenshot were flagged". Flagged boxes are tested with a synthetic result.
- The stub's `detectInputKind` reads an email with headers as a chat; the Messages page's Auto mode works around it. The stub email result's `claimVsReality` comes from the fixture (Income Tax), not from the pasted email.
- Real camera scanning, torch and BarcodeDetector were not run: jsdom has no camera, and this session had no browser.

### Phase 3 — emergency, Elder mode, settings, transactions, dashboard (15 Nov 2026)

- **Emergency (`/sos`)**: a calm full-screen takeover (the shell drops its top bar, mobile header and tab bar on `/sos` and `/sos/report`) in dark red at 12% over the background, with "Leave emergency help" and a "Call 1930" (`tel:1930`) button always visible. One `EMERGENCY.questions` card at a time, with big Yes / No buttons, progress dots, "Question n of 6" and Back. Then the ordered checklist from `buildChecklist` (`lib/emergency.ts`): `always` steps first, then steps whose `when` matches a Yes, both by priority, and `no_loss` steps only when every answer is No. Each step has its action (`tel` as a red button, `url` in a new tab, `internal` as a link) and a tick-off checkbox.
  - **Ghost taps fixed**: while a question card animates out it is still on screen, and a fast second tap used to change the previous answer and skip a question. Answers now count only for the current question. A regression test covers it.
  - **Evidence pack** (M6.2): pick recent checks from history (warnings pre-selected), with their verdict, time, preview and phones / UPI IDs / links, plus the `evidenceChecklist`. "Open complaint draft" saves the draft in sessionStorage, so a reload before printing keeps it.
  - **`/sos/report`**: a print-styled complaint draft with a "not an official document" notice, an editable "What happened, in your words" box (ruled lines when printed), the Yes/No answers, a timeline table of the selected checks, all phones / UPI IDs / links / amounts, and the evidence checklist. "Save as PDF" calls `window.print()`; `styles/print.css` (loaded only by this page) prints A4, black on white, with navigation, toasts and motion hidden.
- **Elder Safety Mode** (§5.10): `html.elder` (20 px base, 56 px taps, solid surfaces, decorative motion off) and `?simple=1` from Phase 0. Quick Scan becomes one big input, one big Check button, and big Upload screenshot / Scan QR buttons. `/scan/:id` becomes a full-screen **STOP** (hand icon) / **CAREFUL** / **No warning signs found** in the risk colour, with one sentence (the first of the explanation), the single most important action as a big card (its link when it has one), "Call {{name}}" (`tel:` from Settings, or a "Set up a family contact" link) and Read aloud, which starts by itself after a fresh scan when voice is on (on by default in Elder mode). "Show details" opens the normal analysis. The reveal is instant in Elder mode.
- **Settings (`/settings`)**: language, Elder mode, read verdicts aloud, haptics, AI second opinion (with the masked-text note, or the offline note), and a trusted family contact (name + phone, checked to 6–15 digits, stored only on this device). The privacy panel counts what is stored locally (checks, screenshots, statements, blocklist, Dojo scores) and the AI calls made with masked text this session (`lib/session.ts`). It also lists the blocklist with remove buttons. "Delete everything" asks for confirmation in a Radix AlertDialog, then clears Dexie (including screenshots) and localStorage and reloads.
- **Transactions (`/modules/transactions`)**:
  - CSV upload by button or drag-and-drop (`.csv` or a CSV type, 5 MB max), or the `SAMPLE_STATEMENTS` cards labelled "Sample data", run through `parseStatementCsv` and `analyzeStatement(txns, uiLang)`.
  - Statement risk on the RiskGauge (40/70 bands) with the narrative.
  - **StatementChart** (hand-made SVG; you chose this over Recharts at about 125 KB gzipped): debits over time on a log ₹ axis, dot size by square root of the amount, the median-to-p90 band shaded in brand colour, and anomalies as risk-coloured dots that are keyboard buttons. The dots pulse **3 times, then stop**: the spec asks for pulsing, but §3.3 lets only ShieldCore loop. No pulse under reduced motion or in Elder mode.
  - Anomaly list sorted by severity, then score, plus an **AnomalyCard** with explanation, feature table (What / This payment / Your usual) and the related transactions.
  - **SpendingSummary**: totals in/out, bars by category (localised spend categories) and in/out by month.
  - Parse errors are listed as "Row 12: …" when the parser gives a row number.
  - Saved to Dexie `statements` (broadcast `statement`), with "Recent statement checks" to reopen them.
- **Dashboard (`/dashboard`)**, Radix tabs:
  - **My shield**: count-up KPI tiles (checks, warnings found, money at risk in flagged messages = sum of amounts in `scam` scans, links and QR codes checked); RecentDetectionsFeed (latest 20, linking to `/scan/:id`, new items slide in); warnings by scam type (bars); checks and warnings over the last 14 days (SVG area + line, with a screen-reader table); and a small network preview from `buildEntityGraph(history, { includeBundled: true })` labelled "Sample data", linking to `/network`.
  - **Live updates**: the feed subscribes to `BroadcastChannel('akshi')` and loads the new record through the in-memory cache first. `storeResult` now broadcasts even when IndexedDB fails, so a dashboard in the same tab still updates in private windows.
  - **Lookup**: `lookupIndicator` results show the report count, scam type, campaign and source (bundled sample data / community / your blocklist), with the "Sample data" badge. A miss says "No reports found for this in our data. That does not mean it can be trusted."
  - **Scam landscape**: `LANDSCAPE` by category, language and channel, plus `PATTERN_CARDS` (with source links when present). Everything carries "Sample data" and the note that it shows the training-data mix, not real-world statistics.
- **Strings**: every new string in en, hi, te and bn (`sos`, `report`, `elder`, `settings`, `tx`, `spend`, `channel`, `dash`).
- **Bundle**: first load 193 KB gzipped. Page chunks: Sos 2.9 KB, SosReport 2.0 KB, Settings 3.0 KB, Transactions 5.0 KB, Dashboard 5.2 KB, Analysis 6.4 KB, Scan 4.5 KB. No new dependencies.
- **Tests** (160 in `apps/web`, 227 in the repo): checklist ordering, the 1930 action, action hrefs, chart maths (linear and log scales, ticks, nice maxima, Indian rupee formatting, dot sizes, day keys), dashboard KPIs (money at risk counts only `scam`), by-category, by-day, `tel:` sanitising, and flows through the real router:
  - **Emergency**: Yes to "sent money" → `tel:1930` and the bank step, with no no-loss step; all No → no-loss steps; tick-off; Back; the ghost-tap regression; the complaint draft with answers, print button and editable box.
  - **Elder mode**: `?simple=1` → simplified scan → full-screen STOP → "Set up a family contact" → Show details; "Call Amma" dials `tel:+919000000000`; first-sentence extraction in English and Hindi.
  - **Settings**: phone validation, saved contact, AI toggle, the AI-calls row, the delete confirmation.
  - **Transactions**: sample → chart group, the top anomaly card and feature table, summary, keyboard anomaly dots; an unreadable CSV → errors section.
  - **Dashboard**: the feed updates live on a scan; Lookup hit with "Sample data", and the miss wording; landscape note and labels.
  - The `/sos` route test now checks the takeover: no navigation, and a `tel:1930` link.

### Phase 4 — landing, story, network, Dojo, Ask, Proof, share cards, PWA (15 Nov 2026)

- **Merge step**: `git fetch` found `origin/main` still at the Phase 0 skeleton (`c81f239`). A's work is on `feat/engine` (up to their Phase 6); C's `feat/data` has not moved. Nothing to merge, so this phase is built on the stubs again. I didn't merge another laptop's branch directly.
- **Dependencies** (all lazy, none in the first load): `react-force-graph-2d` (68 KB gzipped, in the ForceGraphView chunk), `lenis` (5 KB), `html-to-image` (about 5 KB, loaded on share), plus `vite-plugin-pwa` (build-time). **No three.js**: the human chose a Canvas 2D ShieldCore over three.js + R3F (about 249 KB gzipped).
- **Landing (`/`)**: localised hero headline (`text-hero` clamp), subhead, and a glass input with `layoutId="scan-card"`. **LiveRiskMeter** runs `scoreLive` at most every 150 ms on an animation frame, showing a bar in the verdict colour, the number in mono, the verdict word with icon, and up to three signal chips (`signalText`). "Scan now" runs the **real scan** through `useScan` and morphs into `/scan/:id`; the core settles into the live verdict's colour as it goes.
- **ShieldCore** (`components/landing/ShieldCore.tsx`, Canvas 2D, 2.2 KB lazy chunk):
  - A rotating point sphere on a Fibonacci lattice (high tier 6,000 points, mid 2,500), depth-bucketed alpha and size, and a soft glow in the core colour.
  - Each typed character spawns a particle that drifts into the core.
  - An amber or red ring pulse fires when the live score crosses 40 or 70 (`crossedThreshold`).
  - It settles into the verdict colour over 700 ms with slower rotation, and has pointer parallax (fine pointers only).
  - It pauses offscreen (IntersectionObserver) and on a hidden tab, and caps DPR by tier (1.5 / 1.25).
  - **Static poster** on low tier, reduced motion or Elder mode, and as the first paint: the canvas mounts at idle, so LCP is the poster.
- **Scroll story** (`components/landing/Story.tsx`), seven sections. Each animates once in view; only ShieldCore loops.
  1. **Anatomy**: the fake KYC sample (labelled "Sample data") pinned with `position: sticky` while its four strongest red-flag phrases, taken from a real `analyze()` of the sample, lift off with signal labels as `useScroll` progresses.
  2. **PIN rule**: the caption plus the PinPadExplainer, playing once in view.
  3. **Modules**: six cards (Messages, Screenshots, Collect, QR & links, Transactions, Emergency) that tilt toward the cursor on high tier with a mouse.
  4. **Proof**: precision, recall and false alarms on genuine bank SMS count up from `EVAL_REPORT`, with a "Sample data · Placeholder numbers" notice while the report is the fixture.
  5. **Offline**: an airplane toggle switches on, then a real `scoreLive` result of the sample appears ("Checked on this device: risk N").
  6. **Four languages**: the same warning morphs en → hi → te → bn once (all locales loaded on demand), with buttons to pick one.
  7. **CTA** and footer: `tel:1930`, cybercrime.gov.in, Chakshu (sancharsaathi.gov.in/sfc/), the GitHub repo and "Built for Arthaton 2026".
  - **Lenis** runs on the landing page only, on high and mid tier, and not under reduced motion or in Elder mode. It's destroyed on leaving.
- **Network (`/network`)**: `buildEntityGraph(history, { includeBundled: true })`; a lazy **ForceGraphView**.
  - **Nodes**: shape and colour by type (phone circle, UPI diamond, website square, campaign hexagon; brand shades and `--ai`, not risk colours), size by reports, a cyan ring on the user's own details, sample nodes at 55% opacity, and labels when zoomed in.
  - **Interaction**: hover (or the selected node) highlights neighbours and dims the rest. Reduced motion lays the graph out up front (`warmupTicks`) with no animation.
  - **Controls**: type filters, "Only my details" (keeps linked campaigns), a legend, and the stats line "N clusters · largest has M linked details".
  - **EntityPanel** (slide-over): type, value in mono, reports, "Sample data" / "Your details", linked campaigns, and the user's checks that mention it (linking to `/scan/:id`).
  - Every node is also a keyboard button in a list below the graph. If the browser has no canvas, a note shows instead of the graph.
- **Dojo**:
  - **`/learn/dojo`**: a card per drill with category, channel, difficulty dots and best score from Dexie.
  - **`/learn/dojo/:id`**: WhatsApp-style header and bubbles. "Them" messages get typing dots (750 ms of game pacing, not analysis latency; none under reduced motion). Choices are reply bubbles. After a choice, feedback appears, and a red-flag chip (`signalText`) flashes once, green if caught and red if missed.
  - **Ending screen**: "You stayed out of the trap" / "This time the scam worked" (never "safe"), a ScoreRing with count-up against the best possible score (`maxScore`, cycle-safe), caught and missed flags (`tallyFlags`), Play again and a share card. The best score is saved to Dexie `dojo`. A drill missing in the UI language shows "This drill is shown in English".
- **Ask (`/learn/ask`** and a slide-over from a new top-bar button, lazy on first open): FAQ suggestions, then `askAssistant(q, lang, { online: aiOptIn && online })`. Each answer is labelled "Answered offline from Akshi's guide" or "AI-assisted answer" (`--ai`), and its FAQ sources expand inline. Failures say "Could not answer that. For urgent help, call 1930."
- **Proof (`/proof`)**, everything from `EVAL_REPORT`:
  - A **placeholder banner** while the report's notes say PLACEHOLDER (`isPlaceholderReport`); it goes away by itself when C's real report lands.
  - Metric cards (precision, recall, F1, false alarms on genuine bank SMS, each with a one-line meaning) and synthetic vs team-written metrics in a table ("Not measured yet" if handwritten is null).
  - Ablation (rules only → + model → full → full + AI sample, with the AI sample size noted), per-language F1, per-category recall, and a confusion-matrix heatmap (brand intensity by row share, diagonal outlined).
  - Latency p50/p95, statement detection (planted / caught / false flags per 100), a methodology accordion (dataset, template-family splits, team-written set, what "synthetic" means, known limits; it states that real-world accuracy may be lower), datasets with sizes, notes, and report / engine / model versions.
- **Share cards** (`components/share/ShareCards.tsx`, `lib/share.ts`):
  - The card is a 1080×1350 px image in the UI language, sized in px so Elder mode doesn't change it. It's rendered off-screen only when sharing, turned into a PNG by `html-to-image`, and sent through `navigator.share({ files })`, or downloaded with a toast.
  - **Analysis card**: verdict word in the risk colour, category, top two red flags, the scam's UPI IDs and links masked (`kyc.upd…@ybl`, `sbi-kyc….xyz`, never a path), the advice line, and "Checked with Akshi Rakshak" with the site host.
  - The Warn family button now shares this card, with the Phase 1 text share as the fallback.
  - **Dojo card**: drill title, score, flags caught, "Practised with Akshi Rakshak".
- **PWA** (`vite-plugin-pwa`, `registerType: 'autoUpdate'`, registered from `main.tsx` in production only):
  - Manifest: name, short name, theme and background `#05070B`, standalone, icons 192 / 512 / maskable 512, and the share target `GET /share-target` with title/text/url.
  - Icons are generated by `apps/web/scripts/make-icons.mjs` (no image tools: rasterised in Node, PNG via zlib). Also an apple-touch-icon.
  - Workbox precaches the app shell, JS (lexicons ship inside the engine JS; the model JSON chunk is matched by the `*.js` glob once it exists), CSS, woff2 fonts, SVG and PNG: 123 entries, 2.3 MB.
  - `/engine-assets/tessdata/*` is runtime CacheFirst (`akshi-tessdata`) and excluded from precache. `/api/*` is NetworkOnly and excluded from the navigation fallback.
  - **`/share-target`** now redirects straight to Quick Scan with the shared text pre-filled and auto-scanning.
- **Bundle fix**: a `manualChunks` rule for react-force-graph also caught a helper shared by every page, so the 69 KB force-graph chunk loaded on **every route** (first load 263 KB). I removed the rule; the graph is now isolated behind its lazy import, and the config has a comment so it isn't re-added.
- **Robustness**: `scrollIntoView` calls are optional, so a missing scroll helper never takes a route down.
- **Strings**: every new string in en, hi, te and bn (`story`, `network`, `dojo`, `ask`, `proof`, `share`).
- **Tests** (184 in `apps/web`, 251 in the repo):
  - **Logic**: ShieldCore maths (unit sphere, rotation, projection depth, threshold crossings, colour mix), share masking, Dojo best score (cycle-safe) and caught/missed tally, network filter / "only mine" / neighbours / mentions, and proof helpers.
  - **Landing**: live meter, then the hero Scan opens `/scan/:id`; all seven sections, the placeholder label and the three help links.
  - **Network**: every node listed, type filter, entity panel with reports and "Sample data", "only mine".
  - **Dojo**: list → play the best path → red-flag chip → "You stayed out of the trap" → caught list → share button → Play again; a missing drill.
  - **Ask**: online only with opt-in and a connection; a suggested question → offline badge and source.
  - **Proof**: every block, all ablation labels, the methodology "synthetic" item.
  - **Share card**: masks the scam's UPI ID and link path.
  - **Share target**: joins the fields and auto-scans to `/scan/:id`.

#### Bundle sizes vs SPEC_B_WEB §7 (gzipped JS, measured from `dist` by following each page's static imports)

| Route                         | Total        | Budget       | Notes                                                                                                                                                |
| ----------------------------- | ------------ | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| First load (shell, any route) | **196.3 KB** | —            | React, router, i18n (en only), Motion core, Radix menus, Zustand                                                                                     |
| `/scan`                       | **309.0 KB** | **≤ 200 KB** | **Over.** On top of the shell: engine stub 32.3 KB + contracts/zod schemas 26.0 KB (Laptop A's packages), Dexie 31.3 KB (web), page code about 25 KB |
| `/scan/:id`                   | 331.7 KB     | —            |                                                                                                                                                      |
| `/` landing                   | 309.1 KB     | LCP < 2.5 s  | Poster paints first; ShieldCore 2.2 KB loads at idle; Lenis 5.2 KB lazy                                                                              |
| `/modules/qr-link`            | 324.7 KB     | —            | QR worker (jsQR) 45.9 KB loads only without BarcodeDetector                                                                                          |
| `/modules/collect`            | 323.5 KB     | —            |                                                                                                                                                      |
| `/modules/messages`           | 323.0 KB     | —            |                                                                                                                                                      |
| `/modules/transactions`       | 318.4 KB     | —            |                                                                                                                                                      |
| `/learn/dojo/:id`             | 307.4 KB     | —            |                                                                                                                                                      |
| `/dashboard`                  | 298.4 KB     | —            |                                                                                                                                                      |
| `/sos`                        | 296.4 KB     | —            |                                                                                                                                                      |
| `/network`                    | 291.7 KB     | —            | + ForceGraphView 67.8 KB lazy                                                                                                                        |
| `/learn/ask`                  | 257.6 KB     | —            |                                                                                                                                                      |
| `/proof`                      | 258.9 KB     | —            |                                                                                                                                                      |
| `/settings`                   | 259.2 KB     | —            |                                                                                                                                                      |

Lazy chunks: Motion features 31.3 KB (after first paint), command palette 5.9 KB, Ask slide-over 0.3 KB, ShieldCore 2.2 KB, Lenis 5.2 KB, ForceGraphView 67.8 KB, QR worker 45.9 KB. Lighthouse was not run (no browser in this session).

### Phase 5 — integration, languages, accessibility, performance, e2e (15 Nov 2026)

**Integration (§9).** I trial-merged `origin/feat/data` and `origin/feat/engine` (A's Phase 6, `8b25c8e`) on a local throwaway branch. That branch was never pushed and is now deleted. Results with the real engine:

- Typecheck clean; 595/595 unit tests and 53/53 Playwright tests pass after three fixes, all now on `feat/web`:
  - two tests assumed the stub (stage wording; the screenshot test relied on the stub's fake OCR, so it now stubs only OCR and runs the real analysis);
  - the weak-OCR rule now matches the engine's (confidence < 55 or < 15 non-space characters; was 60/12);
  - the three Tesseract cores (3.8 MB each) were being precached. Now they're cached on first use like tessdata. Precache went from 13.8 MB to 2.7 MB.
- The fake KYC sample is a clear **Scam** on A's branch (Request 3 is resolved there).
- A's requests to B: `inlineConst: false` done; engine loads after first paint (`lib/engineLoader.ts`) done; `warmup(lang)` on /scan open and on language change done; engine lazy chunks are precached by `**/*.js` (checked: `engine-*.js` is in `sw.js`).
- **Model chunk:** C's `@akshi/model` is still a stub (`loadModel()` returns null), so there's no model chunk yet. The `model` manual chunk and the `**/*.js` precache will pick it up when C ships the weights as an imported JSON.
- Tessdata loads from `/engine-assets/tessdata/` (CacheFirst, not precached).

**Languages.** en, hi, te and bn have every key (the locale test checks key parity). At 360 px with 200% text there's no horizontal scroll in any language on /, /scan, /modules/collect, /sos and /settings. Screenshots of te Analysis, bn SOS and hi landing show no clipped text. `docs/i18n-review.md` doesn't exist yet, so there were no reviewer corrections to apply.

**Accessibility (§6).** axe (WCAG 2.0/2.1/2.2 A and AA, serious and critical) is clean on 13 routes plus the analysis. Fixes:

- visible focus ring everywhere (Tailwind's `outline-none` was hiding `focus-visible:outline-2`);
- scam fill behind white text raised to 4.96:1 (`--risk-scam-solid`);
- labels on hidden file inputs; stronger "unavailable layer" text; Proof heatmap contrast;
- 200% text: base `grid-cols-1` on 20 responsive grids, wrapping buttons and headers, `min-w-0` in the shell;
- the mobile action dock clears the raised Scan button.

Playwright also checks: the keyboard path Quick Scan → phrase popover → Copy evidence with a visible ring, the aria-live verdict ("Scam. Risk N out of 100."), the gauge label, and Elder tap targets of at least 56 px.

**Performance (§7).**

- A real bug fixed: on Windows, when Vite was started from a lowercase `c:\` cwd (Git Bash), the entry and `@/` imports reached React as `C:/…` and `c:/…`. Rolldown bundled React twice and **every page went blank** (null hook dispatcher). `vite.config.ts` now builds root and alias with an uppercase drive letter.
- Engine, Dexie and broadcast load after first paint; the screenshot/QR sheets, top-bar menus and the More sheet are lazy; Elder scan is split out.
- Four static Geist weights (137 KB) replaced by the variable fonts (29 KB).
- Page headers on / and /scan use a CSS transform-only rise, so the LCP text paints on the first frame (before this, Motion held it at opacity 0 until its features chunk loaded).
- ShieldCore pauses offscreen (Playwright compares canvas frames). Blur layers are unchanged since Phase 4.

| Route (gzipped JS)     | Phase 4  | Phase 5      | Budget      |
| ---------------------- | -------- | ------------ | ----------- |
| First load (any route) | 196.3 KB | **169.1 KB** | —           |
| `/scan`                | 309.0 KB | **180.7 KB** | ≤ 200 KB ✅ |
| `/` landing            | 309.1 KB | 253.6 KB     | —           |
| `/scan/:id`            | 331.7 KB | 327.3 KB     | —           |
| `/modules/qr-link`     | 324.7 KB | 313.2 KB     | —           |
| `/proof`               | 258.9 KB | 234.1 KB     | —           |

Lighthouse 12.6 mobile (simulated slow 4G, 4× CPU) against `vite preview` on this laptop, two runs each:

| Page    | Score | FCP       | LCP       | TBT        | CLS |
| ------- | ----- | --------- | --------- | ---------- | --- |
| `/scan` | 74–75 | 3.4–3.5 s | 4.6–4.7 s | 120–140 ms | 0   |
| `/`     | 70    | 3.4–3.6 s | 5.2 s     | 190–200 ms | 0   |

Before the font and entrance changes: /scan 69 (LCP 5.1 s), / 68 (LCP 5.8 s). **LCP < 2.5 s is not met.** About 90% of LCP is render delay: booting a client-rendered React app under 4× CPU throttling. Getting further would need prerendering the landing and /scan HTML; not done.

**Playwright (§8).** The ten smoke tests pass on desktop-chrome, desktop-edge (msedge channel) and mobile-chrome (Pixel 7): 30/30, plus 22 accessibility tests and 1 performance test, all green on the stub engine and on the trial merge with the real engine. Run with `npx playwright test` in `apps/web`. Set `BASE_URL=https://<preview>` to run against a deployed preview; the local web server is skipped when it's set.

**Real devices.** Laptop Chrome and Edge are covered by Playwright on this machine. **Not done:** a mid-range Android phone and the Vercel preview run. There's no phone here, and without the `gh` CLI I can't read the preview URL. See Deferred.

### Phase 6 — judge tour, demo polish, live listen, personal tips, demo mode (15 Nov 2026)

`origin/main` hadn't moved (still `c81f239`), so there was nothing to merge. `docs/demo-script.md` doesn't exist yet (C hasn't pushed), so the polish pass followed the screen order in the Phase 6 prompt and SPEC.md §13.1.

**Judge tour (§5.17, M12.3).**

- `/tour` shows the six steps and a Start button. `/tour?start=1`, the landing hero's "Take the 60-second tour" link, starts at once.
- Steps run on the real screens: fake KYC on Quick Scan → analysis reveal → collect request + PIN explainer → QR x-ray → Proof numbers → Elder STOP.
- Each step opens its route, rings the element marked `data-tour` (cyan border with the page dimmed; the page stays usable) and shows a caption card with a 6-segment progress bar, Pause, Skip tour and Next/Finish.
- A step lasts 10 s once its target is on screen. If a target hasn't appeared after 8 s, the caption shows anyway. Escape ends the tour.
- Bundled samples only, so it works offline. The KYC text is the engine's own `sample-fake-kyc`.
- The Elder step turns Elder mode on; ending the tour (Finish, Skip or Escape) restores the user's Elder and voice settings.
- The overlay is a lazy chunk; the shell only loads it while a tour runs.
- To support it: collect has a **"Refund desk request" sample chip** and `?sample=refund` (fills the form with a synthetic request and checks it); the QR & link samples moved to `lib/qrSamples.ts`.

**Polish pass (demo order).** Screenshots of every demo screen at 1280×800 and 390×844, then fixes:

- Landing: the compact language switcher wrapped out of the top bar at 1280 px (a Phase 5 side effect); it no longer wraps.
- Landing: the hero headline took five lines at 1280×800 and pushed the input and live meter below the fold. The hero size is now capped by viewport height too (`clamp(3rem, min(7vw, 9vh), 5.5rem)`).
- The "Ctrl K" hint and the "Scan QR" button on the QR page no longer break onto two lines.
- URL anatomy: labels ("PROTOCOL", "REAL WEBSITE") ran together; the segments are spaced now.
- Mobile action dock: a button cut off mid-word at the edge looked broken; the strip now fades at the right edge so it reads as scrollable.
- Statement chart legend: "Out" next to "Your usual range" read like "out of range"; it's now "Other payments" (all four languages).
- Elder mode: switches stretched to 56 px tall pills under the tap-target rule; now they keep their track and grow in proportion. The top-bar help button is a square 56 px.
- Offline: the "Offline — checks still work" pill covered the page title on mobile; `main` now leaves room for it while offline.

The Hindi electricity sample in Elder mode and the Telugu sample show "No warning signs found" with English text **only on the stub engine**; the trial merge with A's engine gives real verdicts in the UI language.

**P2 items.**

- **M1.15 live listen:** a Mic button ("Listen to a call") in the Quick Scan toolbar opens a sheet. It uses the browser's SpeechRecognition with interim results (en-IN, hi-IN, te-IN, bn-IN), restarted after silence, and feeds A's `createLiveListener(lang)`. You get the live risk meter, the transcript (interim words in italics), one alert card per new call danger ("Hang up. Don't share any code…", with the heard phrase), vibration when haptics are on, and "Check this transcript" for a full scan.
  - The sheet says plainly that the browser does speech-to-text (Chrome uses Google's speech service), that the check runs on the device, and that we don't record or save the call.
  - It's shown only when the browser supports SpeechRecognition **and** the engine has `createLiveListener`, so it's hidden on main's stub until A's PR lands. It needs the internet for speech-to-text.
  - Not tried with a real microphone (tested with a fake recognizer).
- **M11.6 personal tips:** a "Tips for you" card on the dashboard. It ranks up to three patterns seen in the user's own flagged checks (OTP/PIN asks, receive-with-PIN, risky links, remote apps, threats/rushing, pay-to-earn), each with "Seen in N of your flagged checks". It nudges to add a trusted contact if none is set, and invites a first check when history is empty. It counts signals only and never quotes message text.
- **M9.2 3D network:** skipped. The human chose to skip it (react-force-graph-3d + three.js is over the 100 KB rule).

**Recording mode (`?demo=1`).**

- Once per page load it clears stored history (scans, screenshots, statements, blocklist, Dojo results) and turns Elder mode off. Settings, language and the trusted contact stay.
- For the session, the sample chips put the script samples first: Fake KYC, Electricity cut-off (Hindi), Part-time job (Telugu), Refund collect request. Change the order in `lib/demo.ts` (`DEMO_SAMPLE_ORDER`) when C's script lands.
- It only reorders: the same sample objects, the same text. A unit test checks every sample's verdict and score are identical in both orders.

**Checks.** Typecheck clean; 265/265 unit tests (38 files; web added the tour, demo, tips and live-listen tests); lint clean in `apps/web`; build OK, one React copy. Playwright 62/62: the 30 smoke tests (3 projects), 22 accessibility tests, 1 performance test, and 9 new tour/demo tests (the full tour with Finish, Escape, and `?demo=1` clearing history and reordering chips, on all 3 projects).

| Gzipped JS  | Phase 5  | Phase 6      | Budget      |
| ----------- | -------- | ------------ | ----------- |
| First load  | 169.1 KB | 172.6 KB     | —           |
| `/scan`     | 180.7 KB | **185.2 KB** | ≤ 200 KB ✅ |
| `/` landing | 253.6 KB | 257.8 KB     | —           |
| `/tour`     | —        | 174.5 KB     | —           |

Precache 2.38 MB (141 entries).

**Recording checklist** (for the human; record with A's engine merged so verdicts are real):

1. Desktop Chrome, window at **1280×800** (or 1920×1080 full screen); browser zoom **100%** (Ctrl+0); **notifications off** (Windows: Do not disturb on), other tabs closed, no extension pop-ups.
2. Open the deployed app once online with **`/?demo=1`** to clear history and put the script samples first, then wait a few seconds so the offline cache installs (needed for the airplane-mode shot).
3. Language starts in English; switch to Telugu/Hindi only at the shots that need it (header switcher).
4. **Airplane-mode step (3:45):** turn Wi-Fi off (or Chrome DevTools → Network → Offline), show the "Offline — checks still work" pill, tap **Fake KYC SMS**, show the verdict; turn Wi-Fi back on before Proof.
5. Elder shot: header **Aa** switch on (or `?simple=1`), language Hindi, voice on; check system volume.
6. For a fallback or a judge, the 60-second tour runs everything offline: `/tour?start=1`.

## In progress

- **Merge 2 is waiting** (order C, A, then B). On 15 Nov `origin/main` still had only the Phase 0 skeleton (`c81f239`). Once A's PR is on `main`: `git fetch`, merge `origin/main` into `feat/web` (take main's `package-lock.json`, then `npm install`), run typecheck, unit tests, build and `npx playwright test`, push, then open the PR `feat/web → main`. The trial merge (Phase 5 above) suggests this goes cleanly apart from the lockfile.
- After the merge, `stageText` in `lib/engine.ts` can become a plain re-export (`TODO(M1)`). The bundler's "stageText is undefined" warning on the stub is expected until then.

### Notes from A's Phase 1 (on feat/engine, not yet on main)

- `stageText(stage, lang)` is new. `lib/engine.ts` already exports `stageText`: it uses the engine's version when present, and otherwise falls back to our `stage.*` locale strings (en/hi/te/bn). After Merge 1, replace the fallback with a plain re-export (marked `TODO(M1)`).
- The real engine returns empty `claimVsReality` and `entities.brands` until A's P2, and the `model`/`ai` stages report `skipped`. In Phase 1, ClaimVsRealityCard must hide itself when the list is empty, the StageTicker must show skipped stages as skipped (not done), and LayerBreakdownBar must grey out unavailable layers.
- Labels and explanations come back in the requested `lang`; pass the UI language to every `analyze` call.
- Fixtures still drive the stubs on main, so Phase 1 screens are built against fixtures and checked against real results after Merge 1.

## Deferred

- vite-plugin-pwa and the manifest/share target: Phase 4, as SPEC_B_WEB §2.1 says.
- `lib/share.ts` (image share cards) and `styles/print.css`: P4 share cards, P3 complaint draft.
- **Charts**: the human chose hand-made SVG over Recharts (about 125 KB gzipped) in Phase 3. RiskLine, StatementChart, the dashboard bars and DayArea are all custom; there's no tooltip or zoom.
- The ShieldCore point sphere uses a Fibonacci lattice rather than icosphere vertices (an even spread with the same look; Canvas 2D, no three.js).
- **M9.2 (3D network toggle) not built:** it needs react-force-graph-3d + three.js (about 150–200 KB gzipped); the human chose to skip it in Phase 6.
- **Live listen (M1.15) not tried with a real microphone**, and hidden until A's engine (with `createLiveListener`) is on main. Try it on a phone call on speaker after Merge 2.
- **`docs/demo-script.md` (C) not written yet:** the polish pass and `DEMO_SAMPLE_ORDER` follow SPEC.md §13.1. Revisit when the script lands.
- **Tour, tips and listen strings in hi/te/bn** are my own translations; please include them in the i18n review.
- **Two-tab live dashboard not checked in a browser**: BroadcastChannel between two real tabs, the print dialog, `navigator.vibrate`, speech and the `tel:` links are covered by unit and flow tests only. Open `/dashboard` in one tab, scan in another, and check the feed.
- **Real-phone test (Phase 2 item 6 and Phase 5 item 5) not done**: camera QR scan, screenshot upload, the PIN explainer, the morph and the mobile dock still need a run on a mid-range Android phone in Chrome through the Vercel preview URL. There's no phone here, and the GitHub CLI isn't installed, so I couldn't read the preview URL either. Then run `BASE_URL=<preview URL> npx playwright test` in `apps/web` against the preview.
- **LCP under 2.5 s** (§7) would need prerendered HTML for / and /scan. Lighthouse mobile is about 70–75; see the Phase 5 table.
- shadcn components beyond the five primitives are added as screens need them, using `components.json`.

## Known issues

- On the stub engine (main) the collect request in Playwright test 4 is only **Suspicious** (and the collect/tour screens show 45); the test accepts that only when `data-engine-version` contains "stub". A's engine floors it at Scam. Likewise the Hindi and Telugu samples show "No warning signs found" in English on the stub only.
- Bengali emergency questions fall back to English: C's content stub only has en and hi.
- **Windows builds:** if a shell's cwd sits inside `apps/web/dist`, Vite can't empty `dist` (EPERM) and you get a stale build without an obvious error. Build from outside `dist`.

- The root `npm run typecheck` does not cover `apps/web` yet (see Request 1). `npm run build -w @akshi/web` runs `tsc -b` on the web project, so type errors still fail the build and CI's build step.
- Checked in desktop Chrome, Edge and emulated Pixel 7 through Playwright (Phase 5), but not yet on a real phone (see Deferred).
- The shared-element morph runs after the Quick Scan page finishes its 250 ms exit (`AnimatePresence mode="wait"`), so the card moves from where it was during the exit. If it looks off in the browser, switch that pair to `mode="popLayout"`.
- `npm audit` reports a moderate minimatch advisory in the root dev dependency `typescript-eslint` (lint only, not shipped). Root dev dependencies are Laptop A's; see Request 4.
- Font files (all scripts, 400/500/600/700) are emitted but only fetched when a glyph in their unicode-range is shown.

## Requests

1. **Laptop A — root `tsconfig.json`:** add `{ "path": "apps/web" }` to `references` so `npm run typecheck` covers the web app. `apps/web/tsconfig.json` is a solution file, and its two projects are composite and emit to `.tsbuild/web/` (already gitignored).
2. **Laptop A — engine bundle size:** please keep `@akshi/contracts/fixtures` out of the real engine (the Phase 0 stub imports it), and add `"sideEffects": false` to `packages/{contracts,engine,content,insights,model}/package.json` if the modules allow it, so the web bundler can drop unused exports. Goal: the engine chunk fits inside `/scan`'s 200 KB budget together with the 189 KB shell, or we agree to load the engine after first paint.
3. **Laptop A / Laptop C — fake KYC sample verdict:** A's log shows `SAMPLE_MESSAGES` fake KYC at 47 (suspicious). The demo and the e2e test both open with it as a clear Scam. Please tune the rules or the sample (or tell B to change the test) before M1.
4. **Laptop A — dev dependency advisory:** `npm audit` flags minimatch (GHSA-g3hv-75wg-m249) through `typescript-eslint` ≤ 8.72.2. The suggested `--force` fix downgrades typescript-eslint (breaking). Lint-only, nothing shipped; bump typescript-eslint when a fixed release is out.
5. **Laptop A — root `eslint.config.js`:** add `'.tsbuild/**'` to `ignores`. After any `tsc -b` (including `npm run typecheck`), `npm run lint` fails with 125 errors in the generated `.d.ts` files under `.tsbuild/` (gitignored, so CI only hits this if lint runs after typecheck in the same job). Real lint is clean in `apps/web`.
