# Laptop B — Web app, UI and experience

Owner: Laptop B. Branch: `feat/web`. Read `SPEC.md` first; this file adds detail and never overrides it.

You own `apps/web/` and `docs/progress/web.md`. Nothing else.

You build against the real package APIs from day one. Before M1 those packages are stubs that return fixture-shaped data (built by A in Phase 0), so every screen can be finished before the real engine arrives. After M1 the same imports return real results with no code change on your side.

---

## 1. Deliverables by phase

| Phase | When | Deliverable |
|---|---|---|
| P0 | Day 1 | Vite app, Tailwind v4, tokens, fonts, shadcn primitives, router with all routes, AppShell (top bar, bottom tabs, SOS, language switcher, Elder toggle), i18n setup (en, hi, te, bn), device tier, engine import surface, Dexie + Zustand stores, Vercel build works |
| P1 | Day 1 | Quick Scan (M1.1, M1.8, privacy toggle, stage ticker) and the Analysis screen (M1.2–M1.6, M1.9) with the full reveal choreography, shared-element transition, reduced-motion path, history saving |
| P2 | Day 2 morning | QR & link module (M4.1, M4.4–M4.6), collect-request module + PIN-pad explainer (M3.1, M3.2), messages module with chat view (M1.12), screenshot flow with OCR progress and boxes (M2.1, M2.2), actions: Reject/Block, Report sheet, Copy evidence (M7.1) |
| P3 | Day 2 | Emergency mode (M6.1, M6.2), Elder Safety Mode (M10.1, M10.2), Transactions module (M5.1, M5.3, M5.5), Dashboard (M8.1–M8.5) with lookup. **M1.** |
| P4 | Day 3 morning | Landing (M12.1, M12.2) with ShieldCore and live meter, page transitions, Network graph (M9.1), Dojo (M11.1), Proof page (M11.4), Ask panel (M11.3), share cards (M7.2), PWA + share target (M13.1, M13.2) |
| P5 | Day 3 | Integrate real engine/model/content from `main`; all four languages; accessibility pass; performance pass; mobile pass on a real phone; Edge pass; Playwright smoke tests. **M2.** |
| P6 | Day 4 | Judge tour (M12.3), P2 items if time (M9.2, M1.15, M11.6), final polish, record the demo video with the team |

---

## 2. Project setup

```
apps/web/
  package.json            name @akshi/web
  index.html
  vite.config.ts
  playwright.config.ts
  public/                 icons, og image, manifest assets, ShieldCore poster image
  src/
    main.tsx  App.tsx  routes.tsx
    lib/engine.ts         the only place that imports @akshi/* packages
    lib/db.ts             Dexie
    lib/store.ts          Zustand
    lib/i18n.ts           i18next init
    lib/motion.ts         tokens and variants
    lib/deviceTier.ts
    lib/broadcast.ts      BroadcastChannel helpers
    lib/share.ts          Web Share, html-to-image
    lib/speech.ts         speechSynthesis / SpeechRecognition wrappers
    locales/{en,hi,te,bn}.json
    styles/tokens.css  styles/globals.css  styles/print.css
    components/ui/        shadcn primitives (generated, then restyled)
    components/shell/  components/scan/  components/analysis/  components/modules/
    components/dashboard/  components/network/  components/learn/  components/emergency/
    components/landing/  components/three/  components/elder/
    pages/                one file per route
  e2e/                    Playwright specs
```

### 2.1 Vite config

- React plugin, Tailwind v4 Vite plugin.
- `vite-plugin-static-copy`: copy `../../packages/engine/assets/**` to `engine-assets/` (tesseract worker, core and tessdata, as A ships them).
- `server.proxy`: `/api` → `http://localhost:3001` (A's dev API server).
- `build.rollupOptions.output.manualChunks`: separate chunks for `three`/`@react-three/*`, `recharts`, `react-force-graph-*`, `tesseract.js`, and the model JSON (dynamic import inside `@akshi/model`).
- vite-plugin-pwa (P4): `registerType: 'autoUpdate'`; precache the app shell, fonts, lexicons and the model JSON; runtime-cache `/engine-assets/tessdata/*` with CacheFirst (large files cached on first OCR use, not precached); never cache `/api/*`.

### 2.2 Engine import surface

`src/lib/engine.ts` re-exports what the app needs from `@akshi/engine`, `@akshi/engine/browser`, `@akshi/insights`, `@akshi/content` and the types from `@akshi/contracts`. Components import from `@/lib/engine` only. This keeps the swap from stubs to real packages invisible.

### 2.3 State

- **Zustand** (`lib/store.ts`), persisted to `localStorage` (wrapped in try/catch): `lang`, `elderMode`, `aiOptIn` (default false), `voiceAuto`, `haptics`, `trustedContact` (`{ name, phone }`, device only), `onboarded`. Runtime only: `deviceTier`, `online`, `lastResultId`.
- **Dexie** (`lib/db.ts`), database `akshi`: `scans` (`id, createdAt, kind, verdict, riskScore, category, inputPreview, result`), `blocklist` (`value, type, addedAt`), `statements` (`id, createdAt, name, analysis`), `dojo` (`drillId, score, completedAt`). "Delete everything" in Settings clears Dexie and local storage, then reloads.
- Every completed scan is saved to `scans` and announced on `BroadcastChannel('akshi')` as `{ type: 'scan', id }`, so an open Dashboard tab updates live.
- `options.blocklist` in every `analyze` call is the list of blocked values from Dexie.

---

## 3. Design system

The feeling is calm under threat: a composed security product, not a hacker movie. Three rules: red, amber and green appear only when they mean a risk level; glow is reserved for the verdict and the shield; every animation shows something that actually changed.

### 3.1 Tokens (`styles/tokens.css`)

| Token | Value | Use |
|---|---|---|
| `--bg` | `#05070B` | page |
| `--surface` | `#0B1018` | solid cards; any surface with paragraphs |
| `--surface-2` | `#111826` | raised cards, inputs |
| `--glass` | `rgba(18,26,38,0.72)` + `backdrop-filter: blur(16px)` + 1px border `rgba(255,255,255,0.08)` | nav, sheets, floating panels |
| `--text` | `#E8EEF6` | primary text |
| `--text-2` | `#93A1B5` | secondary text (AA on `--surface`) |
| `--brand` | `#3DE0FF` | shield, primary buttons, focus ring |
| `--ai` | `#7C5CFF` | anything the LLM contributed |
| `--risk-safe` | `#22C55E` | "No warning signs found" |
| `--risk-warn` | `#F5A524` | suspicious |
| `--risk-scam` | `#FF3B5C` | scam |
| glow | the risk colour at 35% opacity, 24–48px blur | verdict only |
| radius | 12 / 16 / 24 px | chips / cards / sheets |
| spacing | 4px base scale | |

Text on glass needs a backing surface with at least 72% opacity. On low-tier devices `--glass` falls back to `--surface-2` with no blur.

### 3.2 Typography

- Latin: Geist Sans (UI, headings), Geist Mono (scores, UPI IDs, URLs, phone numbers, amounts). Self-host via Fontsource (or the `geist` package).
- Indic: Noto Sans Devanagari, Noto Sans Telugu, Noto Sans Bengali via Fontsource, applied with `:lang(hi)`, `:lang(te)`, `:lang(bn)` selectors on `<html lang>`.
- Line height 1.4 for Latin text, 1.6 for Indic text.
- Scale: 14 / 16 / 20 / 28 / 40; hero `clamp(48px, 8vw, 96px)`. Elder mode: base 20px, scale ×1.25.

### 3.3 Motion (`lib/motion.ts`)

| Token | Value |
|---|---|
| `fast` | 150 ms (hover, press) |
| `base` | 250 ms (most state changes) |
| `slow` | 450 ms (panels, sheets) |
| `page` | 500 ms (route changes) |
| `ease` | `[0.22, 1, 0.36, 1]` |
| `spring.gauge` | stiffness 120, damping 20 |
| `spring.ui` | stiffness 400, damping 30 |

Rules: one attention-grabbing animation on screen at a time; only the landing ShieldCore idles in a loop; wrap the app in `<MotionConfig reducedMotion="user">` and also check `useReducedMotion()` for anything Motion does not cover (count-ups, 3D, Lenis, haptics). Prefer `transform` and `opacity`. No layout-thrashing animations on lists longer than 20 items.

### 3.4 Device tier (`lib/deviceTier.ts`)

`high`: ≥ 8 logical cores and ≥ 8 GB `deviceMemory` (when exposed), no reduced motion, no Save-Data. `low`: ≤ 4 cores, or ≤ 4 GB, or Save-Data, or reduced motion. Otherwise `mid`. Tier decides ShieldCore point count (high 6,000 / mid 2,500 / low: static poster), blur layers, Lenis on/off, tilt effects on/off, and pixel ratio cap (1.5 high, 1.25 mid).

### 3.5 Copy tone

Short, plain, second person. Verbs first on buttons ("Scan", "Decline the request", "Call 1930"). Never "safe" (use "No warning signs found"). Labels for sample data say "Sample data". Hindi in Devanagari, everyday words over formal Sanskrit-heavy ones. All strings live in `locales/*.json`; each non-English file starts with `"_review": "pending"`.

---

## 4. App shell and navigation

- **Desktop top bar** (glass, sticky): logo (eye inside a shield) + "Akshi Rakshak"; Scan; Modules menu (Collect request, Messages, Transactions, QR & links); Dashboard; Network; Learn menu (Dojo, Ask, Proof); language switcher (EN / हि / తె / বা); Elder mode toggle; red pill button "I think I'm being scammed" → `/sos`.
- **Command palette** (`Ctrl/Cmd+K`, cmdk): jump to any route, paste-and-scan, switch language, toggle Elder mode.
- **Mobile**: bottom tab bar — Home, Scan (raised centre button), Dashboard, Learn, More (sheet with Modules, Network, Settings). A red SOS button stays pinned top-right on every screen.
- **Offline indicator**: small pill "Offline — checks still work" when `navigator.onLine` is false.

### 4.1 Routes

| Path | Page |
|---|---|
| `/` | Landing |
| `/scan` | Quick Scan |
| `/scan/:id` | Analysis (loads from Dexie) |
| `/modules/collect` | Collect-request guard |
| `/modules/messages` | Message and chat check |
| `/modules/transactions` | Statement scan |
| `/modules/qr-link` | QR and link inspector |
| `/dashboard` | Dashboard (tabs: My shield, Lookup, Scam landscape) |
| `/network` | Network graph |
| `/sos` | Emergency mode; `/sos/report` printable complaint draft |
| `/learn/dojo`, `/learn/dojo/:id` | Dojo list and player |
| `/learn/ask` | Assistant (also a slide-over panel from anywhere) |
| `/proof` | Proof page |
| `/settings` | Language, Elder mode, AI opt-in, voice, haptics, trusted contact, privacy panel, delete everything |
| `/share-target` | PWA share target; pre-fills Quick Scan |
| `/tour` | 60-second judge tour |

Route changes use `AnimatePresence mode="wait"` keyed by pathname: outgoing fades and moves up 8px, incoming fades in (`page` duration). Scroll resets to top on route change except back/forward.

---

## 5. Screens

### 5.1 Landing (`/`)

**Hero.** Headline "Scan Anything. Stop Fraud Before It Happens." (localised), one-line subhead, a glass input "Paste any message to see the risk", and the ShieldCore beside it (stacked on mobile, core above).

- **LiveRiskMeter**: as the user types, call `scoreLive(text, lang)` at most every 150 ms (requestAnimationFrame + debounce). Show the score as a horizontal meter with the number in Geist Mono and up to three signal chips. Colour shifts through the risk palette.
- **ShieldCore** (`components/three/ShieldCore.tsx`, lazy-loaded): an icosphere of instanced points with a soft brand-colour glow. Typed characters spawn particles that drift into the core. When the meter crosses 40 and 70, a ring pulse travels across the sphere in amber or red. On "Scan", the core settles into the verdict colour and the app navigates to `/scan/:id` (the input card morphs, see §5.3). Pointer parallax on desktop. Pause rendering when offscreen (IntersectionObserver) or when the tab is hidden. Low tier: static poster image with a CSS glow.
- Buttons: "Scan now", "Take the 60-second tour" (P1).

**Scroll story** (Motion `useScroll`/`useInView`; Lenis on high/mid tier only):

1. **Anatomy of a scam**: a realistic fake KYC SMS pinned in view; as the user scrolls, phrases lift off with labels (urgency, lookalike link, OTP request, threat).
2. **The PIN rule**: a phone shows a collect request; a PIN is entered; rupee symbols flow out of the account. Caption: "Your UPI PIN only ever sends money."
3. **Modules**: six cards (Messages, Screenshots, Collect requests, QR & links, Transactions, Emergency) with a slight tilt toward the cursor on desktop.
4. **Proof**: precision, recall and false-alarm rate from `EVAL_REPORT` count up when in view; link to `/proof`.
5. **Works offline**: an airplane-mode toggle animates on and a scan still completes.
6. **Four languages**: the same warning morphs between English, Hindi, Telugu and Bengali.
7. **Call to action**: Scan now; footer with 1930, cybercrime.gov.in, Chakshu, GitHub link, "Built for Arthaton 2026".

### 5.2 Quick Scan (`/scan`)

- One large glass input (textarea, auto-grow). Placeholder: "Paste a message, UPI ID or link".
- **TypeDetectChip**: calls `detectInputKind` as the user types; morphs between Message, Chat, Email, Link, UPI ID, Phone.
- In-input buttons: Paste (Clipboard API; on denial show a tooltip "Long-press and paste"), Upload screenshot, Scan QR (opens `QRScannerSheet`), Mic (P2, M1.15).
- **DropZone**: dragging a file anywhere on the page turns the whole viewport into a drop target.
- **Sample chips** from `SAMPLE_MESSAGES` (at least: fake KYC, collect request, electricity bill, genuine bank OTP). Clicking fills the input and scans.
- **AI second opinion toggle** (default off) with a one-line note: "Only masked text is sent. Phone numbers, UPI IDs and account numbers are hidden first." Disabled with a note when offline.
- **Scan button**: a ring fills while `analyze` runs.
- **StageTicker**: lists stages from `onStage` events (Reading, Checking links, Checking patterns, Model, AI second opinion); each ticks when done. Minimum visible time 400 ms, never longer.
- On result: save to Dexie, broadcast, navigate to `/scan/:id` with the shared-element transition.
- `warmup()` is called when this page mounts.

### 5.3 Analysis (`/scan/:id`)

The input card has `layoutId="scan-card"` on both pages, so it morphs into the message panel.

**Reveal choreography** (after the result is available):

| t | Element |
|---|---|
| 0 ms | Input card becomes the message panel |
| 150 ms | Gauge arc springs from 0 to `riskScore` (`spring.gauge`); number counts up in Geist Mono |
| 400 ms | Verdict label, severity chip and category chip arrive; page background gains a faint radial glow in the risk colour |
| 600 ms | Underlines draw under red-flag spans, strongest first, 80 ms apart |
| 900 ms | Reason rows slide in, weight bars fill |
| 1100 ms | Action dock rises. On `scam`: one `navigator.vibrate(30)` (Android, if haptics on) and the STOP icon pulses once |

Reduced motion: everything appears at once, numbers shown without counting. A visually hidden `aria-live="assertive"` region announces "Scam. Risk 92 out of 100. Fake KYC update." (localised).

**Layout**: desktop two columns (message left, explanation right); mobile stacked with the action dock fixed to the bottom.

Components:

- **VerdictHeader**: `RiskGauge` (SVG arc 0–100 with tick marks at 40 and 70), verdict word ("Scam" / "Suspicious" / "No warning signs found"), `SeverityChip`, `ConfidenceRing`, `CategoryChip` (icon + localised name from `categoryText`).
- **HighlightedText**: the result text with spans underlined by signal colour (risk colours by weight; `--ai` for AI spans). Tap or focus a span → `SignalPopover` with label and detail. Overlapping spans merge visually; the popover lists all signals for that range. For images, `ScreenshotOverlay` draws boxes over the uploaded image instead (M2.2).
- **ReasonList**: signals sorted by weight with a bar; negative-weight signals shown last in green ("Reassuring: tells you not to share your OTP").
- **ClaimVsRealityCard**: two columns, "Claims to be" / "Actually is", one row per `ClaimCheck`, mismatches marked with a red cross icon.
- **EntityChips**: URLs, UPI IDs, phones, amounts in Geist Mono with a risk dot; tapping a URL or UPI ID opens the QR & link inspector pre-filled.
- **LayerBreakdownBar** ("How we decided"): stacked horizontal bar of `layers[].share` with labels Rules / Model / Links / UPI / Known reports / AI; unavailable layers greyed with "off" or "offline".
- **ActionDock**: buttons for the first actions in `actions[]` using `actionText`. Always includes Reject/Block (when there is a sender, UPI ID or link), Report, Copy evidence, Warn family, and the SOS shortcut.
  - **Reject/Block** opens a sheet: generic decline steps ("Open your UPI app → Requests → Decline. Never enter your PIN."), and "Add to my blocklist" (stores UPI IDs, phones, domains in Dexie; future scans flag them with `BLOCKLISTED`).
  - **Report** sheet: 1930 (tel link), cybercrime.gov.in, Chakshu on Sanchar Saathi (for suspected fraud messages and calls, not completed fraud), with an evidence block to copy.
  - **Copy evidence**: plain text with date/time, channel, sender details, UPI IDs, links, amounts, the message, verdict and reasons.
- **PrivacyFooter**: "Checked on this device in 84 ms · AI second opinion: off" or "AI second opinion: Groq · 6 details hidden before sending".
- **Read aloud** button (M1.14): speaks verdict + explanation via `speechSynthesis` in the UI language; picks a voice whose `lang` starts with the language code, falls back to English.
- **Re-check links** button when network extras did not finish.

### 5.4 Collect-request guard (`/modules/collect`)

- **CollectRequestMock**: a phone frame that recreates a collect request as the user fills the form (requester name, UPI ID, amount, note).
- Form fields map to `CollectRequestInput`: "Did they say you will receive money?", "Who contacted first?", "Are they rushing you?", "Do you know this person?" (large toggle buttons), plus optional screenshot upload (runs OCR and pre-fills).
- Result uses the Analysis components inline (not a route change).
- **PinPadExplainer** (M3.2): a PIN pad; as digits are pressed, rupee symbols animate out of an account balance into the requester's avatar; final line in large text: "Entering your PIN sends money. You never need a PIN to receive." Plays automatically once when the verdict involves `RECEIVE_WITH_PIN`; replay button.

### 5.5 Messages (`/modules/messages`)

Paste a single message, a whole chat (WhatsApp export or copied lines), or an email (with headers). For chats, **ChatThreadView** renders bubbles (them left, me right) with each bubble's risk as a small coloured edge, and a **RiskLine** chart (Recharts line) of `chat[].risk` per message, marking where escalation happened. Emails show a header card with From / Reply-To and the mismatch highlighted.

### 5.6 QR & links (`/modules/qr-link`)

- **QRScannerSheet**: camera via `getUserMedia` (rear camera), BarcodeDetector when available, otherwise qr-scanner (or jsQR) in a worker; animated corner brackets; torch toggle if supported; "Upload QR image" alternative. Camera permission denied → explain and offer upload.
- **QRXray**: a card that shows exactly what the QR contains: payee name (`pn`), UPI ID (`pa`, monospace, PSP app name), amount, note; a banner when the QR opens a website instead of a payment.
- **URLAnatomy**: the URL split into coloured parts (scheme, subdomain, registrable domain, path, query); for lookalikes, a row comparing it with the official domain character by character, highlighting `lookalikeDiff`.
- **RedirectHops**: vertical timeline of `expanded.hops` with status codes; final domain emphasised.
- **DomainAgeBadge**: "Registered 4 days ago" (red if < 30 days, amber < 90), or "Age unavailable".
- Link input field for pasting a URL or UPI ID directly.

### 5.7 Screenshot flow

From Quick Scan or Messages: preview the image, call `ocrImage(blob, [uiLang, 'en'])` with a progress bar ("Reading the screenshot — this stays on your phone"), then `analyze({ kind: 'image', text: ocr.text, ocr, ... })`. Weak OCR → "Hard to read. Type the message instead?" with a text box pre-filled with what was read. In the Analysis screen the image replaces the plain text panel, with boxes over flagged words (`image.boxes[].signalIds`), tappable like spans.

### 5.8 Transactions (`/modules/transactions`)

- Upload CSV (drag/drop or picker) or choose one of `SAMPLE_STATEMENTS` (cards with persona titles, labelled "Sample data").
- **StatementChart**: Recharts composed chart — debits over time as dots sized by amount, a shaded band for the user's normal range (median to p90 debit), anomalies as pulsing red/amber dots. Click a dot → **AnomalyCard** with title, explanation and a feature table ("Amount: ₹48,000 · Your usual: ₹650 · 74× higher").
- Anomaly list (sorted by severity), statement risk score, narrative paragraph (M5.6).
- **SpendingSummary**: bars by category and month (in/out).
- Analyses saved to Dexie `statements`. Parsing errors listed with row numbers.

### 5.9 Emergency (`/sos`)

- Full-screen takeover in a calm dark red (`--risk-scam` at 12% over `--bg`), not flashing.
- One `EMERGENCY.questions` item per card with big Yes / No buttons; progress dots.
- Result: an ordered checklist built from `EMERGENCY.steps` (`always` first, then those whose `when` matches a Yes, `no_loss` when every answer was No), each with its action button (`tel:1930`, bank call reminder, links). Tick-off checkboxes.
- **Evidence pack** (M6.2): pick recent scans from history; shows their entities and times.
- **Complaint draft** (`/sos/report`): a print-styled page with an incident timeline (from selected scans and the answers), entities, and a blank section for the user's account of events. "Save as PDF" calls `window.print()`; `print.css` hides navigation and uses black on white.

### 5.10 Elder Safety Mode

Toggle in the header, a question on first visit, or `?simple=1` in any URL (which also sets the persisted flag).

- Adds `class="elder"` on `<html>`: base 20px text, larger tap targets (min 56px), high contrast (`--surface` solid, no glass, no blur), decorative motion off.
- Simplified Quick Scan: one big input, one big Scan button, Upload screenshot, Scan QR.
- Verdict screen becomes full-screen: **STOP** (red, large hand icon), **CAREFUL** (amber), or **No warning signs found** (green), one sentence of explanation, the single most important action as a big button, and "Call my family" (M10.2, `tel:` to the trusted contact set in Settings).
- Verdict is read aloud automatically (`voiceAuto` defaults to true in Elder mode).
- Icons always paired with words.

### 5.11 Dashboard (`/dashboard`)

Tabs:

- **My shield**: KPI tiles (scans, threats caught, money at risk in flagged messages = sum of `amounts` in scans with verdict `scam`, links and QRs checked) with count-up; **RecentDetectionsFeed** (latest 20, new items slide in when a `scan` broadcast arrives); charts by category (bar) and by day (area); mini network preview linking to `/network`; personal tips (P2, M11.6).
- **Lookup** (M8.5): input for a UPI ID, phone number or domain → `lookupIndicator` (+ community count when online, P2). Results show report counts only from bundled sample data or community reports, clearly labelled.
- **Scam landscape** (M8.4): charts from `LANDSCAPE` and `PATTERN_CARDS`, with a "Sample data" label and a line explaining it reflects the training data mix.

### 5.12 Network (`/network`)

- `buildEntityGraph(historyResults, { includeBundled: true })`.
- react-force-graph-2d (lazy). Node shapes and colours by type (phone, UPI ID, domain, campaign); size by `reports`; the user's own entities get a cyan ring; sample-data nodes slightly translucent.
- Hover highlights neighbours; click opens **EntityPanel** (type, value in mono, reports, campaigns, the user's scans that mention it).
- Filters by type and "Only mine". Legend. Stats line ("3 clusters · largest has 14 linked details").
- M9.2 (P2): 3D toggle on desktop high tier with react-force-graph-3d.

### 5.13 Learn

- **Dojo list** (`/learn/dojo`): cards per drill with category, difficulty and best score. **Player** (`/learn/dojo/:id`): WhatsApp-style chat; scammer messages appear with typing dots; choices appear as reply bubbles; after a choice, feedback slides in and any `redFlag` flashes with its localised signal label; ending screen with **ScoreRing**, the red flags you caught and missed, and a share card (M11.2). Scores saved in Dexie.
- **Ask** (`/learn/ask` and a slide-over from the top bar): chat UI with suggested questions from `FAQ`; calls `askAssistant(q, lang, { online: aiOptIn && online })`; shows "Answered offline from Akshi's guide" or "AI-assisted answer"; sources link to FAQ items.
- **Proof** (`/proof`), from `EVAL_REPORT`: metric cards (precision, recall, F1, false-alarm rate on genuine bank SMS), handwritten-set metrics beside synthetic-set metrics, ablation bars (rules only → rules + model → full, and AI sample), per-language bars, per-category recall, confusion-matrix heatmap, latency p50/p95, statement detection result, methodology accordion (dataset, splits by template family, handwritten test set, what "synthetic" means, known limits), dataset sizes.

### 5.14 Settings (`/settings`)

Language; Elder mode; AI second opinion; voice auto-read; haptics; trusted contact (name + phone, stored on this device only); privacy panel listing what is stored locally and what has been sent (count of AI calls with masked text this session); "Delete everything".

### 5.15 Share cards (M7.2)

`ShareCard` renders a 1080×1350 card in the UI language: verdict word, category, the top two red flags, the advice line, "Checked with Akshi Rakshak" and the site URL. `html-to-image` → PNG → `navigator.share({ files })` when supported, otherwise download. Never include the user's own phone number or UPI ID; show the scam's UPI IDs and links partially masked (`kyc.upd…@ybl`).

### 5.16 PWA and share target (M13.1, M13.2)

Manifest: name "Akshi Rakshak", short name "Akshi", theme `#05070B`, icons 192/512/maskable, `display: standalone`, `share_target: { action: "/share-target", method: "GET", params: { title: "title", text: "text", url: "url" } }`. `/share-target` reads the query, joins title/text/url, pre-fills Quick Scan and runs the scan.

### 5.17 Judge tour (M12.3)

`/tour` runs a scripted sequence with coach marks and a progress bar, each step 8–12 s with Next/Skip: fake KYC sample → analysis reveal → collect request with PIN explainer → QR sample with x-ray → Proof page → Elder mode STOP. Uses only bundled samples, so it works offline.

---

## 6. Accessibility

- WCAG 2.2 AA contrast for all text, including on glass.
- Visible focus ring (`--brand`, 2px, offset 2px) on every interactive element. Full keyboard path through Quick Scan → Analysis → actions.
- Verdicts announced through `aria-live`. Gauges have `role="img"` with an `aria-label` stating the score.
- Risk always shown with an icon and a word, never colour alone.
- Tap targets ≥ 44px (56px in Elder mode).
- Text resizes to 200% without loss.
- `lang` attribute set on `<html>` and on any element whose language differs (e.g. Hindi sample on an English UI).
- Camera, microphone and clipboard features always have a non-permission alternative.

---

## 7. Performance

| Item | Budget |
|---|---|
| `/scan` initial JS | ≤ 200 KB gzipped (three, recharts, force-graph, tesseract in lazy chunks) |
| Lighthouse mobile performance on `/scan` | ≥ 90 |
| Landing LCP on mid-range Android over 4G | < 2.5 s (ShieldCore loads after LCP; poster first) |
| Interaction to next paint | < 200 ms on the scan input |
| 3D | DPR cap by tier; pause offscreen; dispose on unmount |
| Blur | at most two simultaneously visible blurred layers; none on low tier |

Use `React.lazy` per page, `Suspense` fallbacks that match final layouts (no layout jump), and `@fontsource` subsets with `font-display: swap`.

---

## 8. Testing

Playwright (`apps/web/e2e`), projects: Desktop Chrome, Desktop Edge (`channel: 'msedge'` where available), Pixel-sized mobile Chrome.

1. Landing loads; typing a scam phrase moves the live meter above 40.
2. Quick Scan sample "fake KYC" → verdict Scam visible, at least one highlighted span, action dock visible.
3. Genuine bank OTP sample → "No warning signs found".
4. Collect-request form with "they said I will receive money" → Scam and the PIN explainer appears.
5. QR sample payload → QRXray shows the UPI ID.
6. Language switch to Hindi changes the verdict text script.
7. Elder mode via `?simple=1` → full-screen verdict.
8. Offline: load once, `context.setOffline(true)`, scan a sample → verdict still appears.
9. Transactions sample statement → at least one anomaly card.
10. Emergency flow: answer "Yes" to "sent money" → a `tel:1930` link is present.

Plus Vitest component tests for `HighlightedText` span merging, `RiskGauge` maths, and the stage ticker minimum-duration logic.

---

## 9. Integration notes (P5)

After merging `main` with the real packages:

- Check every screen with real results: long texts, many signals, no signals, results without the model (`available: false`), AI on and off, offline.
- The model JSON arrives as its own chunk; confirm it is precached and that the first scan after a fresh load shows "Model" in the stage ticker.
- Confirm tessdata loads from `/engine-assets/` (Network tab) and that OCR works in airplane mode after one use.
- Replace any fixture-specific assumptions (fixed string lengths, specific categories).
- Run the Playwright suite against the Vercel preview URL (`BASE_URL` env) as well as locally.
