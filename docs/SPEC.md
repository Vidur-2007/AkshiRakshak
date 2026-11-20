# Akshi Rakshak — master build spec

Version 1.0 · 14 November 2026 · Arthaton 2026 entry (AI for finance)

Akshi Rakshak (अक्षि रक्षक, "the eye that protects") is a web app that checks a message, chat, email, screenshot, UPI collect request, QR code, link, UPI ID, phone number or bank statement for scams aimed at Indian UPI users. In about a second it gives a verdict, a 0–100 risk score, the exact phrases that gave the scam away, what the sender claims to be against what it really is, and what to do next.

Tagline: **Scan Anything. Stop Fraud Before It Happens.**

---

## 0. How these documents work

There are seven files in `docs/`:

| File | Read by | Purpose |
|---|---|---|
| `SPEC.md` (this file) | Everyone | Product, scope, architecture, contracts, git workflow, schedule. Normative for all three laptops. |
| `SPEC_A_ENGINE.md` | Laptop A | Detection engine, shared contracts, Vercel API functions, repo skeleton, deployment |
| `SPEC_B_WEB.md` | Laptop B | The web app: UI, motion, 3D, PWA, accessibility, performance |
| `SPEC_C_DATA.md` | Laptop C | Dataset, model training and export, statement analysis, evaluation, content, README, demo script |
| `PROMPTS_A_ENGINE.md` | Laptop A human | Phase prompts to paste into Claude Code, one per phase |
| `PROMPTS_B_WEB.md` | Laptop B human | Same for Laptop B |
| `PROMPTS_C_DATA.md` | Laptop C human | Same for Laptop C |

Rules of precedence:

1. If a part spec contradicts this file, this file wins.
2. Section 6 (contracts) is frozen after Phase 0. It changes only through the protocol in §9.4.
3. Feature IDs (M1.1, M4.3 …) in §2 are used by the prompts and progress files. Keep them stable.

Each laptop keeps a progress log: `docs/progress/engine.md` (A), `docs/progress/web.md` (B), `docs/progress/data.md` (C). Claude Code updates its own log at the end of every phase with what was done, what was deferred, known issues, and requests for other laptops. Every phase prompt starts by reading the log, so a fresh Claude Code session can continue where the last one stopped.

---

## 1. Product

### 1.1 Users

Anyone in India who pays with UPI. Two groups get special attention: older users (Elder Safety Mode) and the family members who look after them (share cards, `?simple=1` links). The interface and verdicts work in English, Hindi (including romanised Hinglish), Telugu and Bengali.

### 1.2 Promises that shape the engineering

1. **Works offline.** The detection core runs in the browser: rules, link and UPI analysers, the trained classifier and OCR. The network is used only for optional extras (AI second opinion, link redirect expansion, domain age, the online assistant, community reports).
2. **Private by default.** Nothing the user types or uploads leaves the device unless they switch on "AI second opinion", and then only masked text is sent (phone numbers, UPI IDs, account numbers, emails replaced with tags).
3. **Explains itself.** Every verdict lists the phrases and reasons behind it, and the share each layer (rules, model, links, AI) contributed.
4. **Measured.** The Proof page shows precision, recall and false-alarm rate on held-out test data, computed by running the shipped TypeScript engine, not a notebook.

### 1.3 Truth rules (apply to UI copy, README and the demo video)

- Never say "safe". The lowest verdict is **"No warning signs found"**.
- Never fake latency or "AI is thinking" delays. The stage ticker may stay visible for a minimum of 400 ms so it can be read; nothing longer.
- Anything seeded or synthetic shown in the UI carries a visible **"Sample data"** label.
- The money figure is **"Money at risk in flagged messages"**, never "money saved" or "money protected".
- The app cannot block anything inside UPI apps. "Reject / Block" means decline instructions plus a local blocklist that future scans check.
- The synthetic nature of the training data is disclosed on the Proof page and in the README.
- No statistics about scams in India appear anywhere unless they come with a source URL that someone on the team actually opened.

### 1.4 Judging criteria (from arthaton.com) and where we score

| Criterion | What earns it |
|---|---|
| Real-world impact | UPI collect and QR traps, digital-arrest scripts, Elder mode, four languages, emergency flow with 1930 |
| Relevance to theme | Directly named on the theme page ("Scam and fraud detector"); statement scan adds money-management value |
| Works end to end | Every P0 path works offline on the live Vercel URL with bundled samples |
| Use of AI | Trained multilingual classifier with token-level explanations, OCR, anomaly detection, LLM second opinion, measured on a Proof page |
| Creativity / originality | Claims-vs-reality card, PIN-pad explainer, live risk meter, scam Dojo, network graph |
| Demo quality | Scripted 4.5-minute video (§13), 60-second judge tour |

---

## 2. Scope

Priorities: **P0** must work in the demo. **P1** should ship. **P2** only after all P0 and P1 items of that owner are done. Owners: A = engine/API, B = web, C = data/model/content. "A+B" means A builds the logic, B builds the screen.

### M1 Quick Scan and message check

| ID | Feature | Pri | Owner |
|---|---|---|---|
| M1.1 | One input for paste or typing, auto-detects message / chat / email / link / UPI ID / phone | P0 | A+B |
| M1.2 | Verdict, 0–100 risk score, severity, confidence, scam category | P0 | A+B |
| M1.3 | Red-flag phrases highlighted; tap shows why | P0 | A+B |
| M1.4 | "Claims to be vs actually is" card | P0 | A+B |
| M1.5 | Extracted URLs, UPI IDs, phones, amounts with per-item risk | P0 | A+B |
| M1.6 | "What to do now" actions | P0 | A+B |
| M1.7 | Works offline (rules + model) | P0 | A+C+B |
| M1.8 | Sample chips, including one genuine bank OTP SMS | P0 | C+B |
| M1.9 | "How we decided" layer breakdown | P0 | A+B |
| M1.10 | Hindi, Hinglish, Telugu, Bengali detection quality | P1 | A+C |
| M1.11 | AI second opinion (opt-in, masked text) | P1 | A+B |
| M1.12 | Whole-chat check with per-message risk line | P1 | A+B |
| M1.13 | Email check: sender vs claimed brand, reply-to mismatch, risky attachments | P1 | A+B |
| M1.14 | Verdict read aloud; simple-language explanation | P1 | A+B |
| M1.15 | Live listen: microphone phrase spotting during a call (Web Speech API) | P2 | A+B |

### M2 Screenshot check

| ID | Feature | Pri | Owner |
|---|---|---|---|
| M2.1 | Upload or drop a screenshot → on-device OCR → same analysis | P0 | A+B |
| M2.2 | Red-flag boxes drawn on the screenshot | P1 | A+B |
| M2.3 | Cloud vision fallback (Gemini, opt-in) when OCR is weak | P2 | A+B |

### M3 UPI collect-request guard

| ID | Feature | Pri | Owner |
|---|---|---|---|
| M3.1 | Guided form ("someone sent me a request") → verdict | P0 | A+B |
| M3.2 | PIN-pad explainer: entering the PIN sends money out | P0 | B |
| M3.3 | Recognises collect-request screens in screenshots | P1 | A |

### M4 QR and link inspector

| ID | Feature | Pri | Owner |
|---|---|---|---|
| M4.1 | QR via camera or image; decode `upi://pay`; show payee, UPI ID, amount, note | P0 | A+B |
| M4.2 | QR flags: prefilled amount with "receive/refund" wording, brand name on a personal handle, QR that opens a website | P0 | A |
| M4.3 | URL checks: lookalike, homoglyph, punycode, shortener, raw IP, risky TLD, APK download, brand in subdomain, official domain / `.bank.in` recognition | P0 | A |
| M4.4 | URL anatomy view with lookalike character diff | P0 | B |
| M4.5 | Redirect chain expansion (`/api/expand`) | P1 | A+B |
| M4.6 | Domain age via RDAP (`/api/domain-age`) | P1 | A+B |
| M4.7 | UPI deep links inside messages | P1 | A |

### M5 Transactions (statement scan)

| ID | Feature | Pri | Owner |
|---|---|---|---|
| M5.1 | CSV upload plus three bundled sample statements | P0 | C+B |
| M5.2 | Rule anomalies: large new payee, burst of small debits, odd hour, duplicate, credit-then-return, velocity | P0 | C |
| M5.3 | Spending summary by category and month | P0 | C+B |
| M5.4 | Personal baseline and Isolation Forest outliers with "why unusual" features | P1 | C |
| M5.5 | Timeline chart with normal band and anomaly markers; anomaly cards | P0 | B |
| M5.6 | Plain-language statement narrative | P1 | C |

### M6 Emergency mode ("I think I'm being scammed")

| ID | Feature | Pri | Owner |
|---|---|---|---|
| M6.1 | Question cards → tailored checklist (1930, bank, cybercrime.gov.in; Chakshu for attempts) | P0 | C+B |
| M6.2 | Evidence pack from history and printable complaint draft (Save as PDF) | P1 | B |

### M7 Actions and sharing

| ID | Feature | Pri | Owner |
|---|---|---|---|
| M7.1 | Reject/Block (guidance + local blocklist), Report sheet, Copy evidence | P0 | B (action IDs from A) |
| M7.2 | Warn-family share card in the user's language | P1 | B |

### M8 Dashboard

| ID | Feature | Pri | Owner |
|---|---|---|---|
| M8.1 | KPIs: scans, threats caught, money at risk in flagged messages, links/QRs checked | P1 | B |
| M8.2 | Recent detections feed, live across tabs (BroadcastChannel) | P1 | B |
| M8.3 | Charts by category and over time | P1 | B |
| M8.4 | Scam landscape from bundled data (labelled Sample data) | P1 | C+B |
| M8.5 | Lookup: UPI ID / phone / domain against bundled indicators | P1 | A+C+B |
| M8.6 | Community reports via a Vercel Marketplace Redis store | P2 | A+B |

### M9 Network graph

| ID | Feature | Pri | Owner |
|---|---|---|---|
| M9.1 | Entity graph (phones, UPI IDs, domains, campaigns) from history + bundled indicators, 2D | P1 | C+B |
| M9.2 | 3D toggle on desktop | P2 | B |

### M10 Elder Safety Mode

| ID | Feature | Pri | Owner |
|---|---|---|---|
| M10.1 | Large text, one action per screen, full-screen STOP / CAREFUL / No warning signs found, automatic voice, `?simple=1` | P0 | B |
| M10.2 | "Call my family" trusted contact stored only on the device | P1 | B |

### M11 Learn

| ID | Feature | Pri | Owner |
|---|---|---|---|
| M11.1 | Scam Dojo: scripted chats with choices, red-flag reveals, score (≥6 drills P0, 10 drills P1; en/hi/te) | P0 | C+B |
| M11.2 | Dojo share card; Bengali drills | P2 | C+B |
| M11.3 | Ask Akshi assistant: offline FAQ retrieval, online LLM rewrite | P1 | A+C+B |
| M11.4 | Proof page: metrics, layer ablation, confusion matrix, per-language, statement detection, methodology | P0 | C+B |
| M11.5 | Scam pattern cards | P2 | C+B |
| M11.6 | Personal tips from history | P2 | B |

### M12 Landing

| ID | Feature | Pri | Owner |
|---|---|---|---|
| M12.1 | Hero with live risk meter (rescored as you type) and 3D ShieldCore | P0 | B (A provides `scoreLive`) |
| M12.2 | Scroll story sections | P0 | B |
| M12.3 | 60-second judge tour | P1 | B |

### M13 Platform

| ID | Feature | Pri | Owner |
|---|---|---|---|
| M13.1 | PWA install and offline cache | P1 | B |
| M13.2 | Android share target (share an SMS into the app) | P1 | B |
| M13.3 | Local history (IndexedDB), delete all, privacy panel | P0 | B |
| M13.4 | Interface in en + hi (P0), te (P0), bn (P1) | P0/P1 | A+B+C |
| M13.5 | Accessibility and reduced motion | P0 | B |

### Out of scope (decided)

Real-time payment interception, transaction delays and trusted-contact payment alerts (a website cannot see UPI app payments); device fingerprinting, impossible travel, failed-PIN and account-takeover detection (statements do not contain that data); location heatmaps; admin dashboards; user accounts and sign-up; any server-side storage of messages; multi-agent LLM chains (one LLM call per check, because of free-tier rate limits); Tamil, Kannada, Malayalam beyond what the cloud AI handles; customer-care number verification; Kaggle or Colab.

---

## 3. Architecture

```
Browser (phone or laptop) — works offline for text, QR, links (local checks), statements
┌───────────────────────────────────────────────────────────────────────────┐
│ apps/web (React)                                                          │
│   └─ src/lib/engine.ts  ← the only import surface B uses                  │
│        ├─ @akshi/engine          isomorphic core: normalise → entities →   │
│        │                         rules → links/UPI → model → fusion        │
│        ├─ @akshi/engine/browser  OCR (tesseract.js worker)                 │
│        ├─ @akshi/model           classifier JSON + TS inference (lazy)     │
│        ├─ @akshi/insights        statements, Isolation Forest, graph       │
│        └─ @akshi/content         drills, FAQ, emergency, samples,          │
│                                  indicators, eval report                   │
└───────────────┬───────────────────────────────────────────────────────────┘
                │ only when opted in / online; masked text only
                ▼
Vercel Functions (api/, Node runtime, same origin)
   /api/ai/analyze   Groq first, Gemini fallback (Vercel AI SDK, structured JSON)
   /api/ai/vision    Gemini vision (P2)
   /api/expand       redirect chain, SSRF-guarded
   /api/domain-age   RDAP lookup
   /api/ask          assistant grounded in FAQ
   /api/reports      community reports (P2, Marketplace Redis)
   /api/health

Laptop C only (never deployed): ml/ (Python, scikit-learn) → exports packages/model/model/*.json
```

Runtime rules:

1. `@akshi/engine` core must run in both the browser and Node (the eval harness and API functions import it). No DOM APIs in the core. Browser-only code lives in the `@akshi/engine/browser` entry.
2. All network calls from the engine go through one module (`packages/engine/src/net.ts`) to same-origin `/api/*`. Every call has a timeout, an `AbortSignal`, and a silent offline fallback.
3. The web app never calls `/api` directly. It calls engine functions.
4. The model JSON loads lazily on the first scan (or on `warmup()` when the scan page opens) and is precached by the service worker after the first visit.

---

## 4. Tech stack

All free and open source. Hosting is Vercel Hobby only.

| Layer | Choice |
|---|---|
| Language | TypeScript (strict) everywhere except `ml/` (Python 3.11+) |
| Monorepo | npm workspaces |
| Web framework | Vite + React + React Router |
| Styling | Tailwind CSS v4, design tokens as CSS variables |
| UI primitives | shadcn/ui (Radix), lucide-react icons, sonner toasts, cmdk palette |
| Motion | Motion for React (`motion/react`); Lenis on the landing page only |
| 3D | three.js via @react-three/fiber and @react-three/drei (landing, network 3D) |
| Charts | Recharts |
| Graph | react-force-graph-2d (and -3d for M9.2) |
| i18n | i18next + react-i18next |
| Fonts | Geist Sans and Geist Mono; Noto Sans Devanagari, Telugu, Bengali (self-hosted via Fontsource) |
| Local data | Dexie (IndexedDB), Zustand |
| PWA | vite-plugin-pwa (Workbox) |
| QR | Browser BarcodeDetector with a small MIT decoder fallback (qr-scanner or jsQR) |
| Share images | html-to-image |
| PDF | Print stylesheet + browser "Save as PDF" (jsPDF cannot shape Indic scripts) |
| Voice | Web Speech API (speechSynthesis; SpeechRecognition on Chrome/Edge) |
| Validation | zod (contracts, API boundaries, content files) |
| Engine helpers | tldts (public suffix), fastest-levenshtein, tesseract.js |
| AI | Vercel AI SDK (`ai`, `@ai-sdk/groq`, `@ai-sdk/google`); Groq primary, Gemini fallback; model names from env vars |
| Python ML | pandas, numpy, scikit-learn, scipy, pytest — training only, on Laptop C |
| Testing | Vitest (unit), Playwright (Chrome, Edge, mobile viewport smoke tests), pytest |
| CI | GitHub Actions (free for public repos) |
| Hosting | Vercel Hobby: static site + Vercel Functions in `api/`; preview URL per branch |
| P2 storage | Upstash Redis added through the Vercel Marketplace |

---

## 5. Repository layout and ownership

Repository: public GitHub repo `akshi-rakshak` owned by the team lead (Laptop A). Laptops B and C are collaborators.

```
akshi-rakshak/
├─ package.json, package-lock.json*, tsconfig.base.json, eslint/prettier config   A
├─ vercel.json, .env.example, .github/workflows/ci.yml, scripts/                 A
├─ CLAUDE.md                                                                      A
├─ LICENSE (MIT)                                                                  A
├─ README.md                                                                      C
├─ docs/
│  ├─ SPEC*.md, PROMPTS*.md                                                       A (content frozen; typo fixes only)
│  ├─ progress/engine.md                                                          A
│  ├─ progress/web.md                                                             B
│  ├─ progress/data.md                                                            C
│  ├─ dataset-card.md, eval-notes.md, i18n-review.md, demo-script.md, screenshots/ C
├─ packages/
│  ├─ contracts/   types (zod), normalizeText, fixtures                           A (frozen after P0)
│  ├─ engine/      detection engine, strings, lexicons, assets/tessdata           A
│  ├─ model/       model JSON, calibration JSON, TS inference                     C (stub by A in P0)
│  ├─ insights/    statements, Isolation Forest, entity graph                     C (stub by A in P0)
│  └─ content/     drills, FAQ, emergency, samples, indicators, eval report       C (stub by A in P0)
├─ api/            Vercel Functions                                               A
├─ apps/web/       the React app                                                  B
├─ ml/             Python training (not deployed)                                 C
├─ data/           datasets, statements, handwritten test set                     C
└─ eval/           TS evaluation harness (@akshi/eval)                            C
```

`*` `package-lock.json` is shared. See the lockfile rule in §9.3.

Ownership rule: a laptop's Claude Code edits only its own paths. Needs elsewhere go under "Requests" in its progress log, and the human tells the owner. A creates stubs for C's packages in Phase 0 and never touches them again.

---

## 6. Contracts (normative)

`packages/contracts` exports every type below as a zod schema plus its inferred TypeScript type (schema name = type name + `Schema`, e.g. `AnalysisResultSchema`). The TypeScript below is the source of truth for names and shapes. Spans are always UTF-16 code-unit offsets into `AnalysisResult.text` (JavaScript string indices).

### 6.1 Core enums

```ts
export const LANGS = ['en', 'hi', 'te', 'bn'] as const;
export type Lang = (typeof LANGS)[number];
/** Localised string: English required, others optional (fallback to en). */
export type L10n = { en: string } & Partial<Record<Exclude<Lang, 'en'>, string>>;

export type Verdict = 'scam' | 'suspicious' | 'no_signs';
export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'none';
export type InputKind =
  | 'message' | 'chat' | 'email' | 'url' | 'upi_id' | 'phone'
  | 'qr' | 'image' | 'collect_request';
export type Channel = 'sms' | 'whatsapp' | 'telegram' | 'email' | 'call' | 'other' | 'unknown';

export const SCAM_CATEGORIES = [
  'upi_collect', 'qr_receive', 'fake_kyc', 'bill_disconnection', 'digital_arrest',
  'courier_customs', 'job_task', 'investment_crypto', 'loan_app', 'lottery_prize',
  'fake_customer_care', 'refund_cashback', 'wrong_transfer', 'malicious_apk',
  'remote_access', 'otp_theft', 'romance', 'impersonation_govt', 'phishing_link', 'other',
] as const;
export type ScamCategory = (typeof SCAM_CATEGORIES)[number];

export const SIGNAL_IDS = [
  // language and pressure
  'URGENCY', 'THREAT_BLOCK', 'THREAT_LEGAL', 'AUTHORITY_CLAIM', 'SECRECY', 'STAY_ON_CALL',
  // credential and payment asks
  'ASKS_OTP', 'ASKS_PIN', 'ASKS_CVV_PASSWORD', 'ASKS_REMOTE_APP', 'APK_LINK',
  'RECEIVE_WITH_PIN', 'COLLECT_REQUEST', 'QR_TO_RECEIVE', 'ADVANCE_FEE',
  // lures
  'PRIZE_LOTTERY', 'TOO_GOOD_RETURNS', 'TASK_JOB_PAYMENT', 'WRONG_TRANSFER_RETURN',
  'CUSTOMER_CARE_NUMBER',
  // identity
  'BANK_IMPERSONATION', 'BRAND_MISMATCH', 'UPI_NAME_MISMATCH', 'PERSONAL_UPI_HANDLE',
  'REPLY_TO_MISMATCH',
  // links and files
  'SUSPICIOUS_LINK', 'LOOKALIKE_DOMAIN', 'SHORTENED_URL', 'IP_URL', 'RISKY_TLD', 'PUNYCODE',
  'NEW_DOMAIN', 'REDIRECT_CHAIN', 'RISKY_ATTACHMENT', 'PREFILLED_AMOUNT', 'OBFUSCATION',
  // context
  'ESCALATION', 'KNOWN_INDICATOR', 'BLOCKLISTED',
  // layers
  'MODEL_PATTERN', 'AI_FLAG',
  // risk-reducing (negative weight)
  'SAFETY_ADVICE', 'OFFICIAL_DOMAIN',
] as const;
export type SignalId = (typeof SIGNAL_IDS)[number];

export type ActionId =
  | 'decline_request' | 'block_sender' | 'do_not_click' | 'do_not_pay' | 'do_not_share_otp'
  | 'do_not_install' | 'end_call' | 'verify_official' | 'report_chakshu' | 'report_1930'
  | 'report_cybercrime_portal' | 'call_bank' | 'warn_family' | 'emergency' | 'no_action_needed';
```

### 6.2 Analysis types

```ts
export interface Span { start: number; end: number; text: string }

export interface Signal {
  id: SignalId;
  weight: number;            // contribution, -1..1 (negative reduces risk)
  label: string;             // localised short label
  detail: string;            // localised one-line reason
  spans: Span[];             // may be empty
  source: 'rule' | 'model' | 'url' | 'upi' | 'indicator' | 'ai' | 'context';
}

export interface IndicatorMatch {
  value: string; type: 'upi' | 'phone' | 'domain';
  reports: number; category?: ScamCategory; campaign?: string;
  source: 'bundled' | 'community' | 'blocklist'; sampleData: boolean;
}

export interface RedirectChain { hops: { url: string; status: number }[]; finalUrl: string; truncated: boolean; error?: string }
export interface DomainAge { domain: string; registered?: string; ageDays?: number; registrar?: string; error?: string }

export interface UrlFinding {
  raw: string; span?: Span; normalized: string; host: string; registrableDomain: string; tld: string;
  risk: number;                         // 0-100
  flags: SignalId[];
  lookalikeOf?: string;                 // e.g. 'sbi.co.in'
  lookalikeDiff?: { index: number; expected: string; actual: string }[];
  isOfficial: boolean; isShortener: boolean; isApk: boolean;
  expanded?: RedirectChain; domainAge?: DomainAge;
}

export interface UpiIdFinding {
  raw: string; span?: Span; handle: string; psp: string; pspKnown: boolean;
  looksPersonal: boolean; risk: number; flags: SignalId[]; indicator?: IndicatorMatch;
}

export interface PhoneFinding {
  raw: string; span?: Span; e164?: string;
  claimedAs?: 'customer_care' | 'bank' | 'police' | 'courier' | 'unknown';
  indicator?: IndicatorMatch;
}

export interface AmountFinding { raw: string; span?: Span; value: number; currency: 'INR' }

export interface BrandClaim {
  brand: string; kind: 'bank' | 'govt' | 'payment_app' | 'courier' | 'utility' | 'telecom' | 'ecommerce' | 'other';
  span?: Span; officialDomains: string[]; mismatch: boolean; evidence?: string;
}

export interface Entities {
  urls: UrlFinding[]; upiIds: UpiIdFinding[]; phones: PhoneFinding[];
  amounts: AmountFinding[]; emails: string[]; apkMentions: Span[]; brands: BrandClaim[];
}

export interface UpiPayload {
  raw: string; valid: boolean; issues: string[];
  pa?: string; pn?: string; am?: number; cu?: string; tn?: string; mc?: string; tr?: string; url?: string; mode?: string;
}

export interface CollectRequestInput {
  requesterUpi?: string; requesterName?: string; amount?: number; note?: string;
  toldYouWillReceive: boolean;            // "they said I will receive money"
  contactedFirst: 'them' | 'me' | 'unknown';
  underPressure: boolean;
  knowRequester: 'yes' | 'no' | 'unsure';
}

export interface OcrBox { text: string; x: number; y: number; w: number; h: number; start: number; end: number }
export interface OcrResult { text: string; boxes: OcrBox[]; width: number; height: number; confidence: number; langs: Lang[] }

export interface ClaimCheck { claim: string; reality: string; mismatch: boolean; signal?: SignalId }
export interface LayerContribution {
  layer: 'rules' | 'model' | 'links' | 'upi' | 'indicators' | 'ai';
  score: number;        // 0-100, this layer alone
  share: number;        // 0-1, share of the final score
  available: boolean;
}
export interface StageTiming {
  stage: 'read' | 'ocr' | 'links' | 'patterns' | 'model' | 'ai';
  ms: number; status: 'running' | 'done' | 'skipped' | 'failed';
}
export interface ChatTurnRisk { index: number; sender: 'them' | 'me' | 'unknown'; text: string; risk: number; start: number; end: number }

export interface AnalyzeRequest {
  kind: InputKind;
  text?: string;                 // message, chat, email, OCR text, note
  url?: string; upiId?: string; phone?: string;
  qrPayload?: string;            // raw decoded QR string
  collect?: CollectRequestInput;
  ocr?: OcrResult;               // for kind 'image' (call ocrImage first)
  channel?: Channel;
  lang: Lang;                    // language for labels and explanation
  options?: {
    cloudAI?: boolean;           // default false
    expandLinks?: boolean;       // default true when online
    domainAge?: boolean;         // default true when online
    layers?: Partial<Record<'model' | 'links' | 'indicators' | 'ai', boolean>>; // eval toggles
    blocklist?: string[];        // values the user blocked (from web storage)
    signal?: AbortSignal;
  };
}

export interface AnalysisResult {
  id: string; createdAt: string; kind: InputKind; lang: Lang;
  detectedLang: Lang | 'mixed' | 'other';
  text: string;                       // normalised text; all spans index into this
  verdict: Verdict; riskScore: number; severity: Severity;
  confidence: number;                 // 0-1
  category: ScamCategory | null; categoryConfidence: number;
  signals: Signal[];                  // sorted by weight, descending
  claimVsReality: ClaimCheck[];
  entities: Entities;
  qr?: UpiPayload;
  layers: LayerContribution[];
  explanation: string;                // 1-2 sentences, localised
  actions: ActionId[];                // ordered by importance
  stages: StageTiming[];
  chat?: ChatTurnRisk[];
  image?: { width: number; height: number; boxes: (OcrBox & { signalIds: SignalId[] })[] };
  aiUsed: boolean; aiProvider?: 'groq' | 'gemini';
  offline: boolean; latencyMs: number;
  engineVersion: string; modelVersion?: string;
}

export interface LiveScore { riskScore: number; verdict: Verdict; topSignals: SignalId[] }
export interface AssistantAnswer { answer: string; sources: string[]; mode: 'offline' | 'online'; provider?: 'groq' | 'gemini' }
```

### 6.3 Model types (implemented by C in `@akshi/model`)

```ts
export interface Contribution { feature: string; value: number; spans: Span[] }
export interface ModelPrediction {
  pScam: number;                                      // 0-1
  category: ScamCategory | null; categoryProbs: Partial<Record<ScamCategory, number>>;
  contributions: Contribution[];                      // top 25 positive, value desc
}
export interface TextModel { version: string; predict(normalizedText: string): ModelPrediction }
export interface Calibration {
  version: string;
  thresholds: { scam: number; suspicious: number };   // defaults 70 / 40
  fusion: { rules: number; model: number; links: number };  // defaults 0.45 / 0.35 / 0.20
  aiBlend: number;                                    // default 0.2
}
```

### 6.4 Statement, graph and content types (C)

```ts
export type SpendCategory = 'food' | 'groceries' | 'shopping' | 'transport' | 'bills' | 'rent' | 'education'
  | 'health' | 'entertainment' | 'transfers' | 'salary' | 'cash' | 'investment' | 'emi' | 'other';

export interface Txn {
  id: string; date: string /* ISO datetime; time 00:00 if unknown */; hasTime: boolean;
  description: string; amount: number; direction: 'debit' | 'credit'; balance?: number;
  channel: 'UPI' | 'IMPS' | 'NEFT' | 'RTGS' | 'CARD' | 'ATM' | 'OTHER';
  counterparty?: string; upiId?: string; category: SpendCategory;
}
export interface ParsedStatement { txns: Txn[]; errors: string[]; format: 'canonical' | 'bank_a' | 'bank_b' | 'unknown' }
export interface Anomaly {
  id: string; txnIds: string[];
  type: 'large_new_payee' | 'burst_small_debits' | 'odd_hour' | 'duplicate' | 'credit_then_return'
      | 'round_amount_new_payee' | 'velocity' | 'isolation_outlier';
  severity: 'high' | 'medium' | 'low'; score: number; // 0-1
  title: string; explanation: string;                 // localised
  features: { name: string; value: string; baseline: string }[];
}
export interface StatementAnalysis {
  txns: Txn[]; anomalies: Anomaly[];
  baseline: { medianDebit: number; p90Debit: number; usualHours: [number, number] | null; frequentPayees: string[] };
  summary: { totalIn: number; totalOut: number; byCategory: { category: SpendCategory; amount: number }[];
             byMonth: { month: string; in: number; out: number }[] };
  riskScore: number; narrative: string;
}

export interface GraphNode { id: string; type: 'phone' | 'upi' | 'domain' | 'campaign'; label: string; risk: number; mine: boolean; reports: number; sampleData: boolean }
export interface GraphEdge { source: string; target: string; kind: 'appears_with' | 'part_of' }
export interface EntityGraph { nodes: GraphNode[]; edges: GraphEdge[]; stats: { clusters: number; largestCluster: number } }

export interface DrillChoice { id: string; text: L10n; next: string; points: number; feedback: L10n; redFlag?: SignalId }
export interface DrillNode { id: string; from: 'them' | 'system'; text: L10n; choices?: DrillChoice[]; end?: 'safe' | 'scammed' }
export interface Drill {
  id: string; title: L10n; category: ScamCategory; difficulty: 1 | 2 | 3;
  channel: 'whatsapp' | 'sms' | 'call'; persona: { name: string; avatar: 'bank' | 'police' | 'courier' | 'recruiter' | 'buyer' | 'support' | 'unknown' };
  langs: Lang[]; start: string; nodes: Record<string, DrillNode>;
}
export interface FaqItem { id: string; q: L10n; a: L10n; tags: string[] }
export interface EmergencyQuestion { id: 'sent_money' | 'entered_pin' | 'shared_otp' | 'installed_app' | 'gave_remote_access' | 'shared_card'; text: L10n }
export interface EmergencyStep {
  id: string; when: EmergencyQuestion['id'][] | 'always' | 'no_loss';
  priority: number; title: L10n; body: L10n;
  action?: { kind: 'tel' | 'url' | 'internal'; value: string; label: L10n };
}
export interface EmergencyContent { questions: EmergencyQuestion[]; steps: EmergencyStep[]; evidenceChecklist: L10n[] }
export interface Indicator { value: string; type: 'upi' | 'phone' | 'domain'; category: ScamCategory; reports: number; campaign?: string; sampleData: true }
export interface SampleMessage { id: string; label: L10n; kind: InputKind; lang: Lang; text: string; expected: Verdict; genuine: boolean }
export interface PatternCard { id: string; category: ScamCategory; title: L10n; body: L10n; sourceUrl?: string }
export interface Landscape { byCategory: { category: ScamCategory; count: number }[]; byLang: { lang: Lang; count: number }[]; byChannel: { channel: Channel; count: number }[]; sampleData: true }

export interface Metrics { precision: number; recall: number; f1: number; accuracy: number; fpr: number; support: number }
export interface EvalReport {
  generatedAt: string; engineVersion: string; modelVersion: string;
  datasets: { name: string; size: number; description: string }[];
  overall: Metrics;                                   // full system without AI on the synthetic test split
  handwritten: Metrics | null;                        // team-written test set
  configs: { name: 'rules_only' | 'rules_model' | 'full_no_ai' | 'full_ai_sample'; metrics: Metrics; n: number }[];
  perCategory: { category: ScamCategory; recall: number; support: number }[];
  perLang: { lang: Lang; precision: number; recall: number; f1: number; support: number }[];
  fprGenuineBank: number;                             // false alarms on genuine bank/OTP SMS
  confusion: { labels: string[]; matrix: number[][] };
  latency: { p50Ms: number; p95Ms: number };
  statements: { injected: number; caught: number; falseFlagsPer100: number } | null;
  notes: string[];
}
```

### 6.5 Package APIs

```ts
// @akshi/contracts
export function normalizeText(raw: string): string;   // see §7.1; used by engine and model

// @akshi/engine (isomorphic) — owner A
export const ENGINE_VERSION: string;
export function analyze(req: AnalyzeRequest, onStage?: (s: StageTiming) => void): Promise<AnalysisResult>;
export function scoreLive(text: string, lang?: Lang): LiveScore;          // sync, rules only, <5 ms per 1,000 chars
export function detectInputKind(raw: string): { kind: InputKind; confidence: number };
export function parseUpiUri(raw: string): UpiPayload;
export function inspectUrl(url: string, opts?: { expand?: boolean; domainAge?: boolean; signal?: AbortSignal }): Promise<UrlFinding>;
export function maskPII(text: string): { masked: string; replacements: number };
export function lookupIndicator(value: string): IndicatorMatch | null;
export function askAssistant(question: string, lang: Lang, opts?: { online?: boolean; signal?: AbortSignal }): Promise<AssistantAnswer>;
export function signalText(id: SignalId, lang: Lang): { label: string; detail: string };
export function categoryText(c: ScamCategory, lang: Lang): { name: string; oneLiner: string };
export function actionText(a: ActionId, lang: Lang): { label: string; body: string; href?: string };
export function warmup(lang?: Lang): Promise<void>;                       // loads model, pipeline, lexicons, strings (lang: only that language's)
export function apiHealth(): Promise<{ online: boolean; ai: boolean }>;

// @akshi/engine/browser — owner A
export function ocrImage(image: Blob, langs: Lang[], onProgress?: (p: number) => void): Promise<OcrResult>;

// @akshi/model — owner C
export const MODEL_VERSION: string;
export function loadModel(): Promise<TextModel | null>;                   // lazy; null if unavailable
export function loadCalibration(): Calibration;                           // sync; defaults if file missing

// @akshi/insights — owner C
export function parseStatementCsv(csv: string): ParsedStatement;
export function analyzeStatement(txns: Txn[], lang: Lang): StatementAnalysis;
export function buildEntityGraph(history: AnalysisResult[], opts?: { includeBundled?: boolean }): EntityGraph;
export const SAMPLE_STATEMENTS: { id: string; title: L10n; persona: string; csv: string }[];

// @akshi/content — owner C
export const DRILLS: Drill[];
export const FAQ: FaqItem[];
export const EMERGENCY: EmergencyContent;
export const INDICATORS: Indicator[];
export const SAMPLE_MESSAGES: SampleMessage[];
export const PATTERN_CARDS: PatternCard[];
export const LANDSCAPE: Landscape;
export const EVAL_REPORT: EvalReport;
```

### 6.6 HTTP API (Vercel Functions, owner A)

All bodies JSON. Errors: `{ "error": { "code": "bad_request" | "rate_limited" | "upstream_unavailable" | "timeout" | "internal", "message": string } }` with a 4xx/5xx status. The engine turns every error into a graceful fallback; the UI never shows a raw error.

| Method & path | Request | Response |
|---|---|---|
| `POST /api/ai/analyze` | `AiAnalyzeRequest` | `AiAnalyzeResponse` |
| `POST /api/ai/vision` (P2) | `{ imageBase64: string; lang: Lang }` (≤1.5 MB) | `{ text: string }` |
| `GET /api/expand?url=` | — | `RedirectChain` |
| `GET /api/domain-age?domain=` | — | `DomainAge` |
| `POST /api/ask` | `{ question: string; lang: Lang; faqIds: string[] }` | `AssistantAnswer` |
| `GET /api/reports?type=&value=` (P2) | — | `{ reports: number; category?: ScamCategory }` |
| `POST /api/reports` (P2) | `{ type: 'upi'\|'phone'\|'domain'; value: string; category: ScamCategory }` | `{ ok: true; reports: number }` |
| `GET /api/health` | — | `{ ok: true; version: string; ai: { groq: boolean; gemini: boolean } }` |
| `POST /api/analyze` (added 2026-11-20) | `{ text: string; lang?: Lang; kind?: 'message'\|'chat'\|'email'\|'url'\|'upi_id'\|'phone'\|'qr' }` (text ≤ 20,000 chars; kind detected when missing) | `{ result: AnalysisResult; attackStory: AttackStep[]; tactics: TacticFound[] }` |

**`POST /api/analyze` (developer sandbox).**
- It runs the same engine on the server: rules, model, link checks and UPI checks.
- It makes **no AI call, no link expansion and no domain lookup**, so it spends no quota and makes no outbound request.
- Limits and privacy: 30 per minute per IP, same origin only for browsers (curl and scripts work), and the text is never logged.
- **The app never calls it.** Text checks stay on the device.

**Evidence guard (added 2026-11-20).** Besides the "safe" rule (§1.3), AI text that states a fact no check found is dropped. The AI score still counts. Dropped text:
- report counts or "blacklisted", unless the device's own lookup found the value;
- "verified" or "confirmed fraud" claims;
- a UPI ID, phone number or website that is in neither the message (or, for `/api/ask`, the question and the FAQ references) nor the official list. The official list is `.gov.in`, `.nic.in`, RBI and NPCI; 1930 is always allowed.

```ts
export interface AiAnalyzeRequest {
  maskedText: string;                // ≤ 4,000 chars, already masked by maskPII
  kind: InputKind; lang: Lang;
  ruleSignals: SignalId[]; localCategory: ScamCategory | null; localScore: number;
}
export interface AiAnalyzeResponse {
  provider: 'groq' | 'gemini'; model: string;
  category: ScamCategory | null; likelihood: number;  // 0-100
  explanation: string;                                // ≤ 60 words, in lang
  redFlags: { quote: string; reason: string }[];      // ≤ 5; quote is an exact substring of maskedText
  advice: string;
}
```

### 6.7 Fixtures

`packages/contracts/fixtures/` holds JSON examples that validate against the schemas (a test enforces this). They let B build every screen before the real engine arrives, and C build the eval harness before the real engine arrives.

`analysis-scam-kyc.json`, `analysis-suspicious-job.json`, `analysis-nosigns-otp.json`, `analysis-collect.json`, `analysis-qr.json`, `analysis-url.json`, `analysis-image.json`, `analysis-chat.json`, `analysis-email.json`, `statement-analysis.json`, `entity-graph.json`, `eval-report.json`, `drill.json`.

---

## 7. Detection pipeline summary

Details are in `SPEC_A_ENGINE.md`.

### 7.1 Normalisation (shared, in `@akshi/contracts`)

`normalizeText(raw)`: Unicode NFKC → remove U+200B, U+200C, U+200D, U+2060, U+FEFF → map Devanagari (U+0966–096F), Bengali (U+09E6–09EF) and Telugu (U+0C66–0C6F) digits to ASCII 0–9 → replace every run of whitespace with one space → trim. C's Python featuriser implements the same steps; a parity test checks both.

### 7.2 Stages

`read` (normalise, detect language and kind) → `ocr` (images only) → `links` (URL, UPI, QR, phone checks; network extras when online) → `patterns` (rules and lexicons in four languages) → `model` (classifier) → `ai` (only if opted in and online) → fusion.

### 7.3 Score, verdict, severity

- Fusion produces `riskScore` 0–100 (integer). Hard floors from decisive signals apply after fusion (e.g. RECEIVE_WITH_PIN ⇒ ≥ 85).
- Verdict uses `Calibration.thresholds`: score ≥ scam (70) → `scam`; ≥ suspicious (40) → `suspicious`; otherwise `no_signs`.
- Severity: ≥ 85 critical, 70–84 high, 40–69 medium, 15–39 low, < 15 none.
- C tunes thresholds and fusion weights through `packages/model/model/calibration.json`, based on the validation split only, never the test splits.

---

## 8. Languages

| Code | Language | Scripts handled | UI | Detection | Dojo |
|---|---|---|---|---|---|
| en | English | Latin | P0 | P0 | P0 |
| hi | Hindi | Devanagari + romanised Hinglish | P0 | P0 | P0 |
| te | Telugu | Telugu | P0 | P0 | P0 |
| bn | Bengali | Bengali | P1 | P1 | P2 |

Strings are drafted by Claude and must be checked by a human who reads the language (checklist in `docs/i18n-review.md`, owned by C). A warning that reads badly will not be read. Fallback for any missing string is English.

---

## 9. Git workflow

### 9.1 Branches and accounts

| Laptop | GitHub account | Branch | Vercel preview |
|---|---|---|---|
| A | team lead (repo owner) | `feat/engine` | automatic per push |
| B | member 2 (collaborator) | `feat/web` | automatic per push |
| C | member 3 (collaborator) | `feat/data` | automatic per push |

`main` is the live site. Nobody commits to `main` directly after Phase 0. Merges happen only through pull requests at the checkpoints below.

### 9.2 Commit and push rhythm

- Commit after every meaningful step (conventional messages: `feat(engine): …`, `fix(web): …`, `data: …`).
- Push at least at the end of every phase, and before any break longer than an hour.
- Never commit `.env`, API keys, real phone numbers, real UPI IDs, real bank details, PAN or Aadhaar numbers.

### 9.3 Merge checkpoints

| Checkpoint | When | Order |
|---|---|---|
| M0 | Day 1, ~45 minutes in | A pushes the Phase 0 skeleton to `main`; B and C branch from it |
| M1 | End of Day 2 | PRs merged C → A → B. Before each PR, the branch merges the latest `main` and passes CI. After all three, every branch merges `main`. |
| M2 | End of Day 3 | Same order. After M2, `main` deploys to production. |
| Freeze | Day 4 midday | Only bug fixes, via small PRs, until submission |

The team lead (A) merges PRs after CI passes. Use merge commits, not rebases, on shared branches.

**Lockfile rule:** on a `package-lock.json` conflict, take `main`'s version (`git checkout --theirs package-lock.json` during a merge of main into your branch), run `npm install`, run the tests, commit. Never hand-edit the lockfile.

### 9.4 Contract change protocol

1. The laptop that needs a change writes the exact diff it wants under "Requests" in its progress log and tells A's human.
2. A makes the change on `feat/engine`, updates fixtures and the schema test, and merges a small PR into `main` immediately (outside the checkpoints).
3. B and C merge `main` into their branches.

Additive changes (new optional fields) are cheap. Renames and removals need all three humans to agree.

---

## 10. Environment and Vercel

Environment variables (Vercel project settings → Environment Variables; locally in `.env`, never committed; `.env.example` lists names only):

| Name | Used by | Notes |
|---|---|---|
| `GROQ_API_KEY` | `/api/ai/*`, `/api/ask` | Free tier key from console.groq.com |
| `GROQ_MODEL` | same | A current Groq model that supports structured JSON output; check the console |
| `GEMINI_API_KEY` | same | Free tier key from Google AI Studio |
| `GEMINI_MODEL` | same | A current Flash or Flash-Lite model available on the free tier |
| `GEMINI_VISION_MODEL` | `/api/ai/vision` (P2) | Vision-capable free-tier model |
| Marketplace Redis vars | `/api/reports` (P2) | Use whatever names the Upstash integration injects; read them in one config module |

Vercel project: import the GitHub repo (Hobby plan), framework preset "Other", root directory = repo root. `vercel.json` (A) sets the build command, output directory `apps/web/dist`, SPA rewrites and security headers. Every branch push gets a preview URL; `main` is production. Hobby is for non-commercial use, which this entry is.

Local development: `npm run dev` starts the web app (Vite) and a small local API server (`scripts/dev-api.ts`, port 3001) that mounts the same handlers as `api/`. Vite proxies `/api` to it. No Vercel login is needed for local work.

---

## 11. Schedule

3.5 working days. "Day" means a working day for the team, not a calendar date. Phase prompts live in the PROMPTS files.

| | Day 1 | Day 2 | Day 3 | Day 4 (half) |
|---|---|---|---|---|
| **A** | P0 skeleton (first ~45 min) → push `main`; P1 normalise, entities, rules, lexicons; P2 links, UPI, QR, collect, fusion | P3 model integration, OCR, API functions → **M1** | P4 chat, email, assistant, lookup, AI polish; P5 integrate, tune, deploy → **M2** | P6 hardening, security, final deploy |
| **B** | (wait ≤45 min: read specs) P0 scaffold, tokens, shell; P1 Quick Scan + Analysis screen on fixtures | P2 modules (QR/link, collect, messages, screenshot), history, actions; P3 emergency, elder, transactions, dashboard → **M1** | P4 landing + 3D, network, Dojo, Proof, Ask, share cards, PWA; P5 integrate real engine, i18n, a11y, perf → **M2** | P6 judge tour, polish, record video |
| **C** | (wait ≤45 min: humans start handwritten test messages) P0 env, taxonomy, generator; P1 dataset | P2 train, export, TS inference, parity; P3 statements, Isolation Forest, eval harness, content → **M1** (merged first) | P4 eval on real engine, error analysis, retrain, calibration, drills, graph; P5 final eval, README → **M2** | P6 demo script, submission checklist |

### 11.1 Cut rules

If any owner's P0 items are not done by the end of Day 2:

1. Drop that owner's P2 items entirely, then P1 items in this order: M5.6, M11.2, M1.15, M8.6, M9.2, M2.3, M11.6, M11.5, M1.13, M8.4.
2. Never cut: offline text checks (M1.7), the Proof page (M11.4), the collect-request guard (M3.1, M3.2), Elder mode (M10.1), the emergency flow (M6.1).
3. Bengali UI and detection drop to "English fallback" before any P0 feature is cut.

---

## 12. Quality bars and definition of done

### 12.1 Bars

| Area | Bar |
|---|---|
| Browsers | Latest Chrome and Edge on Windows/macOS; Chrome on Android (mid-range phone); Safari is best-effort |
| Widths | 360, 390, 768, 1024, 1280, 1536 px |
| Performance | `/scan` ≤ 200 KB gzipped JS before lazy chunks; Lighthouse mobile performance ≥ 90 on `/scan`; analyse p95 < 150 ms for a 2,000-character message with the model loaded |
| Accessibility | WCAG 2.2 AA contrast; full keyboard use; screen-reader announcement of verdicts; reduced motion respected; works at 200% text zoom |
| Offline | After one online visit, text, link (local checks), QR and statement checks work in airplane mode |
| Privacy | No message text in logs (client or server); only masked text reaches `/api/ai/*` |
| Tests | Engine golden cases, model parity, statement anomalies, schema fixtures, Playwright smoke (including an offline scan) all pass in CI |

### 12.2 Definition of done for a feature

Works on the Vercel preview URL on a phone and a laptop; handles empty, huge, and mixed-language input without crashing; has loading, error and offline states; uses only contract types; strings exist in en, hi and te (bn where P1 says so); tests cover the logic; progress log updated.

---

## 13. Demo and submission

### 13.1 Demo video (< 5 minutes; aim for 4:30)

| Time | Shot |
|---|---|
| 0:00–0:20 | Landing. Type "Your SBI account will be blocked today, update KYC" into the hero; the live meter climbs to red. Tagline. |
| 0:20–1:10 | Quick Scan with the fake KYC sample → analysis reveal: gauge, highlights, claims vs reality, how we decided. |
| 1:10–1:50 | Collect-request guard and the PIN-pad explainer. |
| 1:50–2:20 | QR x-ray and URL anatomy on a lookalike link. |
| 2:20–2:50 | A Telugu screenshot → OCR boxes → verdict in Telugu. |
| 2:50–3:20 | Statement scan: anomalies on the timeline, "why unusual". |
| 3:20–3:45 | Elder mode: full-screen STOP, voice in Hindi; warn-family card. |
| 3:45–4:10 | Airplane mode on, scan still works. Proof page numbers. |
| 4:10–4:30 | Emergency mode; close on 1930 and the tagline. |

C writes the full script and shot list in `docs/demo-script.md`; B records the screen; all three review.

### 13.2 Submission checklist (from the hackathon rules)

- Public GitHub repository with all source code and a README explaining what the app does and how to run it.
- README credits every open-source library and AI API used (Groq, Gemini, tesseract.js, and the rest).
- Demo video of the working app, under 5 minutes.
- No real bank details, passwords, PAN numbers or API keys anywhere in the repo.
- Team lead submits the GitHub link and video link through the emailed submission link before **22 November 2026, 23:59 IST**.

---

## 14. CLAUDE.md (A creates this file verbatim in Phase 0)

```markdown
# Akshi Rakshak — instructions for Claude Code

Scam and fraud detector for Indian UPI users (Arthaton 2026). Read docs/SPEC.md first, then your laptop's spec (SPEC_A_ENGINE.md, SPEC_B_WEB.md or SPEC_C_DATA.md), then your progress log in docs/progress/.

## Ownership — never edit files outside your area
- Laptop A, branch feat/engine: packages/contracts, packages/engine, api/, scripts/, root config files, vercel.json, .github/, CLAUDE.md, docs/SPEC*.md, docs/PROMPTS*.md, docs/progress/engine.md
- Laptop B, branch feat/web: apps/web/, docs/progress/web.md
- Laptop C, branch feat/data: packages/model, packages/insights, packages/content, ml/, data/, eval/, README.md, docs/progress/data.md, docs/dataset-card.md, docs/eval-notes.md, docs/i18n-review.md, docs/demo-script.md, docs/screenshots/
If you need a change outside your area, write the exact request under "Requests" in your progress log and stop working on that item.

## Contracts
packages/contracts is frozen after Phase 0. Follow SPEC.md §9.4 for any change. Import types only from @akshi/contracts.

## Rules
- TypeScript strict. No `any` in exported APIs. Validate data crossing package or network boundaries with zod.
- No secrets, real personal data, real bank details, PAN or Aadhaar numbers in the repo. Use obviously synthetic values.
- No paid services. Free tiers and open-source packages only.
- Text checks must keep working offline.
- Follow the truth rules in SPEC.md §1.3 in all user-facing text.
- Prefer small, well-known dependencies. Ask the human before adding a dependency over 100 KB gzipped to the web bundle.
- Write tests for logic. Keep commits small with conventional messages.

## Before you end a phase
1. npm run typecheck && npm test (and npm run build -w @akshi/web if web code changed)
2. Update your progress log: done, deferred, known issues, requests
3. Commit and push your branch
4. Print a short summary for the human: what works, how to see it, what is next

## Commands
npm install · npm run dev · npm run dev:api · npm test · npm run typecheck · npm run lint · npm run eval
```
