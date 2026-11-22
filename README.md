<div align="center">

# Akshi Rakshak — अक्षि रक्षक · అక్షి రక్షక · অক্ষি রক্ষক

### _Scan Anything. Stop Fraud Before It Happens._

**"The eye that protects": a scam and fraud checker for UPI users in India, that runs on your phone, offline, in four languages**

**Arthaton 2026 · AI for finance**

[**Live app**](https://akshi-rakshak.vercel.app) · [**Demo video (YouTube, 5 min)**](https://youtu.be/FD6xtVlQ9hk) · [**1-minute intro**](https://akshi-rakshak.vercel.app/video/akshi-rakshak.mp4) · [**Proof page (our measured results)**](https://akshi-rakshak.vercel.app/proof) · [**API health**](https://akshi-rakshak.vercel.app/api/health) · [**60-second tour**](https://akshi-rakshak.vercel.app/tour)

![TypeScript](https://img.shields.io/badge/Engine-TypeScript-3178C6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/UI-React%2019-61DAFB?logo=react&logoColor=black)
![scikit-learn](<https://img.shields.io/badge/Model-scikit--learn%20(runs%20in%20the%20browser)-F7931E?logo=scikitlearn&logoColor=white>)
![Python](https://img.shields.io/badge/Training-Python%203.11-3776AB?logo=python&logoColor=white)
![Offline](https://img.shields.io/badge/Text%20checks-work%20offline-0F766E)
![Vercel](https://img.shields.io/badge/Hosting-Vercel-000000?logo=vercel&logoColor=white)
![Cost](<https://img.shields.io/badge/Cost-%E2%82%B90%20(100%25%20free%20tier)-brightgreen>)

![Akshi Rakshak landing page in the night theme, with Akshi view on: the sample fake KYC SMS is marked Scam 95/100 and each risky phrase is labelled](docs/screenshots/hero-dark-akshi.png)

### ▶ Watch Akshi Rakshak in 1 minute

[![Watch the 1-minute Akshi Rakshak video](docs/videos/akshi-rakshak-video-poster.png)](https://akshi-rakshak.vercel.app/video/akshi-rakshak.mp4)

_▶ Click to watch the 1-minute intro (58 s)_ · **[▶ Full demo video on YouTube (5 min)](https://youtu.be/FD6xtVlQ9hk)**

</div>

---

## Team

**Team name:** Maximus Decimus Meridius

**Members:**

- Vidur Bandaru
- Anugnya.S
- Murari Geddam

We split the work into three parts, each built on its own branch from one shared specification ([`docs/SPEC.md`](docs/SPEC.md)): the detection engine, API and deployment (`feat/engine`), the web app (`feat/web`), and the dataset, model, evaluation and content (`feat/data`).

---

## Table of contents

1. [The problem](#1-the-problem)
2. [Our approach](#2-our-approach)
3. [Features](#3-features)
4. [How the AI works](#4-how-the-ai-works)
5. [Our ML model and results](#5-our-ml-model-and-results)
6. [Architecture](#6-architecture)
7. [Tech stack](#7-tech-stack)
8. [Screenshots](#8-screenshots)
9. [Run it locally](#9-run-it-locally)
10. [Demo walkthrough](#10-demo-walkthrough)
11. [Privacy, safety and responsible AI](#11-privacy-safety-and-responsible-ai)
12. [AI tools used](#12-ai-tools-used)
13. [Limitations and future work](#13-limitations-and-future-work)
14. [Repository structure](#14-repository-structure)

---

## 1. The problem

UPI made paying anyone in India instant. It also made it instant to lose money to a stranger. The tricks are old, but they now arrive by SMS, WhatsApp, calls, QR codes and payment requests, in the user's own language:

- **"Enter your PIN to receive money."** A collect request or QR code is presented as a refund, prize or "wrong transfer". On UPI a PIN only ever _sends_ money, but many people don't know that.
- **Fake authority.** "Your SBI account will be blocked today", "This is CBI, you are under digital arrest", "Your electricity will be cut tonight". Fear and a deadline leave no time to think.
- **Disguised text.** Scammers write "0TP", "S H A R E", "O.T.P" or use lookalike letters to slip past filters.
- **Language.** Most warnings and tools are in English. Many people get scams in Hindi, Telugu, Bengali or romanised Hinglish.
- **Older users and families.** Parents and grandparents are often targeted, and the family member who looks after them is not there when the message arrives.
- **After the loss.** People don't know the first steps: call 1930 and report at cybercrime.gov.in, fast.

A useful checker has to answer in about a second, explain _why_ in plain words, work on a cheap phone with a weak connection, and never upload a person's private messages to do it.

---

## 2. Our approach

Akshi Rakshak is **one detection engine behind several ways to check**, plus help before and after a scam:

| Part                 | For                            | What it does                                                                                                                          |
| -------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Quick Scan**       | Anyone                         | Paste a message, chat, email, link, UPI ID or phone number, or upload a screenshot; get a verdict, a 0–100 risk score and the reasons |
| **Modules**          | Specific traps                 | Collect-request guard, QR and link inspector, messages and chats, bank-statement scan                                                 |
| **Detection engine** | (in the browser)               | Rules in four languages, our own trained model, link and UPI checks, known indicators, fusion                                         |
| **Learn**            | Everyone                       | Scam taxonomy network, Dojo drills, Ask (answers with sources)                                                                        |
| **SOS**              | Someone who already lost money | Six questions, then the steps that matter most right now (1930 first)                                                                 |
| **Proof**            | Judges, sceptics               | Every number we measured, including the weak spots                                                                                    |

Six design principles drove every decision:

1. **On the device first.** Text, screenshots and statements are checked in the browser. Nothing is uploaded for a normal check, and text checks work in airplane mode.
2. **Our own model, not just an API wrapper.** The core is our rules plus a model we trained and ship to the browser. An LLM second opinion is optional, sees masked text only, and can move the score by at most 15 points.
3. **Explain, don't just flag.** Every verdict shows the exact phrases, what the sender claims against what it really is, how the scam works step by step, and what to do next.
4. **Never say "safe".** The lowest verdict is "No warning signs found". A clean result can still be a scam we don't know yet.
5. **Honest numbers.** Every number is our own measurement, on a split we never tuned on, with where it came from. Sample data is labelled as sample data.
6. **₹0 to run.** Free tiers and open-source packages only.

---

## 3. Features

<details open>
<summary><b>Checking something</b></summary>

- **Quick Scan** (`/scan`) for messages, chats, emails, links, UPI IDs and phone numbers, with a **live risk meter** that moves while you type.
- **Screenshot check:** on-device OCR (English, Hindi, Telugu, Bengali), with boxes drawn over the risky words on your screenshot. **Sample screenshots** (a bank SMS, a chat asking for the OTP, a Telugu job SMS) let you try it without a phone.
- **Messages and chats:** full chat threads are read turn by turn, with a risk line that shows the conversation turning into a scam.
- **Collect-request guard:** a short form about a UPI collect request, a live preview of the request, and the **PIN explainer** ("entering your PIN always sends money").
- **QR and link inspector:** what a QR really pays (payee, UPI ID, prefilled amount), link anatomy (the real domain, lookalikes, risky endings), short-link expansion and domain age (optional, online).
- **Bank-statement scan:** upload a statement CSV; unusual payments are flagged on the device, each with a plain reason.
- **Live listen:** checks a call as it is spoken (browser speech recognition).
- **Share target:** on Android, share a message straight into the app.

</details>

<details open>
<summary><b>Understanding the result</b></summary>

- **Verdict, risk score and confidence**, with the scam category.
- **Underlined phrases:** tap one to see why it was flagged.
- **Claims to be vs actually is:** "Says it is from SBI" against "Link goes to sbi-kyc-update.xyz". Includes **payment truth** ("you'll receive ₹5,000" really means ₹5,000 leaves your account) and an **authority check** (police, CBI or ED asking for money on a personal UPI ID).
- **Attack story and manipulation tactics:** how this scam works, step by step, and which levers it pulls (fear, urgency, authority, secrecy, greed).
- **Scam Replay:** how the scam would have played out, built only from what was found in the message.
- **"You're not the only one" (Campaign Match):** how many similar messages are in our sample dataset, the closest example, and the campaign it shares details with.
- **How we decided:** what each layer (rules, model, links, known reports, AI) added to the score.
- **What to do now:** up to five actions in order, plus buttons to block, report on Chakshu, copy evidence, warn family, or get help.
- **Repeated collect requests:** a warning when the same UPI ID has asked you for money before.
- **Was Akshi right?** Tell the app whether it was right. Answers stay on the phone, never change a verdict, and can be downloaded as labelled examples.

</details>

<details open>
<summary><b>Detection (the engine)</b></summary>

- **43 warning signals** across 19 scam types, matched in English, Hindi (Devanagari and romanised Hinglish), Telugu and Bengali, with negation handling ("we will never ask for your OTP" is not an OTP request).
- **Our own scam model**, trained in Python and run in the browser (section 5).
- **Disguise-proof matching:** spaced, dotted and starred letters, digits for letters, lookalike Cyrillic and Greek letters, hidden characters and repeated letters are read through, while underlines still land on the original characters.
- **Link and UPI checks:** lookalike and punycode domains, risky endings, shortened links, bank names on personal UPI handles, "pay to receive" QR codes, prefilled amounts.
- **Known indicators** (sample data) and **your own blocklist:** a number, UPI ID or website you blocked is flagged if it comes back.
- **Optional AI second opinion** on masked text, with an evidence guard that drops any AI claim the message doesn't support.

</details>

<details open>
<summary><b>After a scam</b></summary>

- **SOS** (`/sos`): six questions lead to tagged recovery steps, with **call 1930** and **cybercrime.gov.in** first when money has left the account.
- **Evidence report** (`/sos/report`): a ready-to-file summary of what happened.
- **Statements linked to scams:** a payment in your statement is linked to scam checks about the same person or UPI ID, with "This payment vs your usual" spending.

</details>

<details open>
<summary><b>Learning</b></summary>

- **Network** (`/network`): "A taxonomy of scams", an interactive map of all 19 scam types, the lever each one pulls (fear, trust, greed, urgency) and how it reaches people (SMS, WhatsApp, call, Telegram, email). Three scenes: Radar, Nebula, Blueprint.
- **Dojo:** practice drills where you spot the scam.
- **Ask:** questions about scams and UPI safety, answered with the source.
- **Landing story** with a cosmic intro (replayable) and a 60-second guided tour.

</details>

<details open>
<summary><b>Accessibility and reach</b></summary>

- **Four languages:** English, Hindi, Telugu, Bengali, for the app, the verdicts and the explanations.
- **Elder Safety Mode:** one full-screen answer (STOP / CAREFUL / No warning signs found), read aloud in the user's language, with **Call my family**. Families can send `?simple=1` links.
- **Share cards** to warn family and friends.
- **Installable app (PWA)** that works offline after one visit.
- Screen-reader and keyboard support, large tap targets, reduced motion, dark mode; checked with axe on every page.

</details>

<details open>
<summary><b>Proof and developer API</b></summary>

- **Proof page** (`/proof`): precision, recall and F1 by layer, by language and by scam type, the confusion matrix, risk calibration, speed and statement results.
- **Public API:** `POST /api/analyze` returns the same check as the app (text kinds, no AI), rate-limited.
- **Telegram bot:** forward a message to the bot to check it (code deployed; switched off until a webhook secret is set).

</details>

---

## 4. How the AI works

Every check passes through this pipeline. The solid path runs in the browser in under a millisecond for a typical message (median 0.15 ms, 95th percentile 0.94 ms, measured on the test split). The dashed path is optional and online.

```mermaid
flowchart TD
    A["Input<br/>message / chat / email / screenshot /<br/>QR / link / UPI ID / phone / statement"] --> B["1. Read<br/>OCR for images (tesseract.js, on device),<br/>detect language and input type"]
    B --> C["2. Extract<br/>links, UPI IDs, phone numbers, amounts"]
    B --> V["3. Matching view<br/>undo disguises: S H A R E, O.T.P,<br/>0TP, lookalike letters"]
    V --> R["4a. Rules<br/>43 signals in en / hi / te / bn,<br/>with negation"]
    V --> M["4b. Our scam model<br/>TF-IDF + logistic regression<br/>(runs in the browser)"]
    C --> L["4c. Link and UPI checks<br/>lookalikes, risky endings,<br/>personal handles, QR traps"]
    C --> K["4d. Known indicators<br/>sample data + your blocklist"]
    R --> F{"5. Fusion and calibration"}
    M --> F
    L --> F
    K --> F
    F --> O["6. Verdict, risk score, confidence, category,<br/>claims vs reality, attack story, actions"]
    F -. "optional, online,<br/>masked text only" .-> AI["AI second opinion<br/>Groq, then Gemini"]
    AI -. "evidence guard,<br/>at most +15 points" .-> O
```

### Fusion

Each layer gives a score from 0 to 100. The weights come from our calibration file (`packages/model/model/calibration.json`, set on the validation split):

```
rules   R = 100 × (1 − Π(1 − wᵢ))        over the warning signals that fired
model   M = 100 × P(scam)
links   L = highest link or UPI risk      (only when the input has links or UPI IDs)

base    = (0.30 × R + 0.35 × M + 0.35 × L) / (sum of the weights of the layers present)
base    = max(base, known-indicator score)
final   = AI used ? 0.8 × base + 0.2 × AI : base
final   = min(final, base + 15)           // the AI alone can never add more than 15 points
final   = max(final, any safety floor)    // e.g. "enter your PIN to receive" is always a scam
```

| Risk score | Verdict                                   |
| ---------- | ----------------------------------------- |
| 70–100     | **Scam**                                  |
| 40–69      | **Suspicious**                            |
| 0–39       | **No warning signs found** (never "safe") |

**Confidence** = 0.55 + 0.1 × (strong signals, max 3) + 0.15 × (agreement between rules and model), kept between 0.5 and 0.98.

### Which AI does what

| Task                        | Primary                                        | Fallback                                  |
| --------------------------- | ---------------------------------------------- | ----------------------------------------- |
| Verdict, score, reasons     | **Our rules + our model** (in the browser)     | Always available, no network              |
| Screenshot reading          | tesseract.js on the device                     | Optional Gemini transcription, asks first |
| Second opinion (optional)   | Groq (`openai/gpt-oss-20b`)                    | Google Gemini Flash-Lite                  |
| Ask (questions and answers) | Our FAQ with sources; Groq rewrites the answer | The FAQ answer as written                 |
| Statement anomalies         | Our rules + an Isolation Forest in TypeScript  | Always available, no network              |

---

## 5. Our ML model and results

### The model

|                    |                                                                                                                                                                                                                                   |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Task**           | Is a message a scam (binary), and which of 19 scam types (category)                                                                                                                                                               |
| **Features**       | TF-IDF over word 1–2-grams and character 2–5-grams (18,793 features), with Indian-language normalisation                                                                                                                          |
| **Classifier**     | Logistic regression (scikit-learn), plus a sparse second model for the category                                                                                                                                                   |
| **Shipped as**     | JSON, 133 KB gzipped, run in TypeScript in the browser. Python and TypeScript give the same results (checked on 200 texts)                                                                                                        |
| **Version**        | `2026.11.18-a` · validation F1 0.963 · category macro-F1 0.650                                                                                                                                                                    |
| **Training data**  | 3,579 synthetic messages (1,739 scams in 19 categories, 1,840 genuine) in English, Hindi (41% romanised), Telugu and Bengali, from 250 hand-written template families. Families never cross the train, validation and test splits |
| **Hard negatives** | 900 genuine messages that look like scams: real-style OTPs, debit alerts, UPI confirmations, delivery updates, bank offers, fraud-awareness notices                                                                               |
| **Training time**  | Seconds on a laptop CPU, no GPU                                                                                                                                                                                                   |

### Results

From `npm run eval` on the held-out **test split** (527 messages, full system without the AI second opinion; "flagged" = Scam or Suspicious). Engine 0.3.0, model 2026.11.18-a. Nothing was tuned on this split.

|                        | Precision |    Recall |        F1 | False alarms |
| ---------------------- | --------: | --------: | --------: | -----------: |
| Rules only             |     95.3% |     49.8% |     65.4% |         2.1% |
| Rules + model          |     96.4% |     85.4% |     90.6% |         2.9% |
| **Full system, no AI** | **96.7%** | **94.7%** | **95.7%** |     **2.9%** |

**By language (F1):** English 96.5% · Hindi 95.2% · Telugu 92.0% · Bengali 100%.

**Genuine bank, OTP and UPI messages:** 6 of 140 (4.3%) were marked "suspicious"; **none** got the "scam" verdict.

**Confusion matrix** (same 527 test messages; rows are the truth, columns are Akshi's verdict):

|                    | Scam | Suspicious | No warning signs | Total |
| ------------------ | ---: | ---------: | ---------------: | ----: |
| **Really a scam**  |  125 |        109 |               13 |   247 |
| **Really genuine** |    0 |          8 |              272 |   280 |

Every message that got the Scam verdict really was a scam (counting only Scam as flagged: precision 100%, recall 50.6%). Most of the other scams land in Suspicious, which still tells you to stop and check. The scam type was named correctly for 68.4% of the flagged scams.

<details>
<summary><b>Caught, by scam type</b> (test split, Scam or Suspicious counts as caught)</summary>

| Scam type                          | Caught |
| ---------------------------------- | -----: |
| Bill disconnection threat          |  10/10 |
| Courier or customs fee             |  10/10 |
| Digital arrest                     |  27/27 |
| Fake customer care                 |  10/10 |
| Fake KYC update                    |  10/10 |
| Government impersonation           |    9/9 |
| Investment or crypto               |  24/24 |
| Task or job scam                   |  25/27 |
| Loan app                           |  10/10 |
| Lottery or prize                   |  10/10 |
| Malicious app (APK)                |    9/9 |
| OTP theft                          |    9/9 |
| Phishing link                      |  10/15 |
| QR code to "receive" money         |  10/10 |
| Refund or cashback                 |  10/10 |
| Remote access app                  |  14/14 |
| Romance                            |    3/9 |
| UPI collect request                |  15/15 |
| "Sent by mistake" (wrong transfer) |    9/9 |

</details>

**How we tested:** the dataset is split by template family, so no test message shares a template with a training message. Model settings, thresholds and weights were chosen on the validation split only; the test split is used only to report these numbers. Speed: 0.15 ms median, 0.94 ms at the 95th percentile per text check, on a laptop.

**Do the risk numbers mean what they say?** The same test messages grouped by the risk Akshi gave them (Brier score 0.07; 0 is perfect, 0.25 is a coin toss):

| Risk                    | Messages | Really scams |
| ----------------------- | -------: | -----------: |
| 70–100 (Scam)           |      126 |   126 (100%) |
| 40–69 (Suspicious)      |      116 |    108 (93%) |
| 0–39 (No warning signs) |      285 |      13 (5%) |

**Disguised text:** 12 base scams in five languages × 9 disguises (spaced, dotted, starred, lookalike letters, digits for letters, hidden characters…): the main warning signal is still found in **108 of 108** (50 of 108 before the matching view was added).

**Statement scan:** 6 of 6 planted unusual payments caught, 0 false flags per 100 transactions on the sample statements.

**Weak spots:** romance scams (3 of 9 caught) and phishing links (10 of 15).

The data is synthetic, so expect lower numbers on real messages. Every number above, by language and by scam type, is on the app's [**Proof** page](https://akshi-rakshak.vercel.app/proof). How they were produced: [`docs/eval-notes.md`](docs/eval-notes.md) and [`docs/dataset-card.md`](docs/dataset-card.md). Reproduce with `npm run eval` and `npm run reliability -w @akshi/eval`.

> **Why our own model plus rules, and the LLM only as an option?** Rules are exact and explainable, but miss new wording. Our model generalises, is tiny, free, works offline and never sees the network. An LLM is strong but can be confidently wrong, is rate-limited on free tiers, and would need the message to leave the phone. So the LLM gets masked text, a fixed 20% share, and can never add more than 15 points.

---

## 6. Architecture

```mermaid
flowchart LR
    subgraph Phone["Browser on the phone (PWA, works offline)"]
        UI["React 19 app<br/>Scan · Modules · Learn · SOS · Proof"]
        EN["Detection engine (TypeScript)<br/>rules · model · links · UPI · fusion"]
        OCR["tesseract.js OCR<br/>en / hi / te / bn"]
        INS["Statement scan<br/>rules + Isolation Forest"]
        DB[("IndexedDB (Dexie)<br/>history, blocklist, feedback")]
        SW["Service worker<br/>offline cache"]
    end
    subgraph VC["Vercel (free tier)"]
        API["Serverless functions /api<br/>health · analyze · ai/analyze · ai/vision ·<br/>ask · expand · domain-age · reports · telegram"]
    end
    GRQ["Groq API"]
    GEM["Gemini API"]
    RDAP["RDAP<br/>(domain age)"]
    UP[("Upstash Redis<br/>(optional report counts)")]

    UI --> EN
    UI --> OCR
    UI --> INS
    UI --> DB
    UI -. "optional, masked text" .-> API
    API --> GRQ
    API --> GEM
    API --> RDAP
    API --> UP
```

**Key decisions**

- **The engine is a library, not a server.** The same `@akshi/engine` package runs in the browser, in the API (`/api/analyze`) and in the evaluation harness, so the Proof numbers are the app's numbers.
- **Offline core.** Rules, the model, link checks, OCR assets and the app shell are cached by the service worker. Only the optional extras (AI second opinion, short-link expansion, domain age, report counts) need the network, and the app works without each of them.
- **Contracts first.** `packages/contracts` holds the shared types and zod schemas; anything crossing a package or network boundary is validated.
- **Hardened API.** Rate limits on every route, an SSRF guard on link expansion (private addresses refused before connecting), no message text in logs, and security headers on every response.

---

## 7. Tech stack

Everything below is free and open source, or used on a free tier.

| Layer                          | Technologies                                                                                                   |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| **Engine**                     | TypeScript (strict), zod, tldts, our own rule and fusion code                                                  |
| **ML (training, not shipped)** | Python 3.11, scikit-learn, NumPy, SciPy, pandas, joblib, PyYAML, pytest                                        |
| **ML (in the browser)**        | Our TypeScript inference for the exported model; Isolation Forest in TypeScript                                |
| **OCR**                        | tesseract.js with `eng`, `hin`, `tel`, `ben` from tessdata_fast, self-hosted                                   |
| **LLM providers (optional)**   | Groq and Google Gemini through the Vercel AI SDK (`ai`, `@ai-sdk/groq`, `@ai-sdk/google`), JSON-schema answers |
| **API**                        | Vercel Functions (Node), undici, Upstash Redis (optional)                                                      |
| **Frontend**                   | React 19, React Router, Vite, Tailwind CSS v4, shadcn/ui (Radix), lucide-react, cmdk, sonner                   |
| **Motion and graphics**        | Motion, Lenis, Canvas 2D and WebGL (no 3D library), react-force-graph-2d                                       |
| **Data and state**             | Dexie (IndexedDB), zustand, i18next                                                                            |
| **Offline**                    | vite-plugin-pwa (Workbox)                                                                                      |
| **Testing**                    | Vitest (≈870 tests), Testing Library, jsdom, Playwright (Chrome, Edge, mobile Chrome), axe-core                |
| **Hosting**                    | Vercel (static app + functions), GitHub Actions CI                                                             |
| **Fonts**                      | Geist, Geist Mono, Noto Sans Devanagari, Noto Sans Telugu, Noto Sans Bengali (Fontsource)                      |

---

## 8. Screenshots

### Landing page

![How Akshi decides: message, rules, on-device model, link check, then the verdict and next steps](docs/screenshots/home-how-akshi-decides.png)

**How Akshi decides:** your message goes through the rules, the on-device model and the link check, then you get a verdict and what to do next.

|                                                                                                                           |                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| ![19 tricks, shield off](docs/screenshots/home-deck-off.png) **"19 tricks, caught": flick through common scams in India** | ![19 tricks, shield on](docs/screenshots/home-deck-on.png) **Shield on: every card is marked Caught, with its warning signs** |

### The checks

|                                                                                                                      |                                                                                                                                |
| -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| ![Analysis](docs/screenshots/analysis.png) **Scam, 95: underlined phrases and the reasons**                          | ![Claims vs reality and Scam Replay](docs/screenshots/analysis-why.png) **Claims vs reality, and how the scam would play out** |
| ![Campaign Match](docs/screenshots/campaign-replay.png) **"You're not the only one": similar messages and campaign** | ![Collect request](docs/screenshots/collect.png) **Collect-request trap and "What the PIN really does"**                       |
| ![QR inspector](docs/screenshots/qr-link.png) **What this QR really does**                                           | ![Statement scan](docs/screenshots/statement.png) **Statement scan, linked to scams**                                          |
| ![Network](docs/screenshots/network.png) **A taxonomy of scams**                                                     | ![Dojo](docs/screenshots/dojo.png) **Dojo practice drills**                                                                    |
| ![Proof](docs/screenshots/proof.png) **Proof: every number we measured**                                             | ![Risk calibration](docs/screenshots/proof-calibration.png) **Do the risk numbers mean what they say?**                        |
| ![Emergency help](docs/screenshots/sos.png) **SOS: the steps that matter most, 1930 first**                          | ![Elder mode in Hindi](docs/screenshots/elder-mode.png) **Elder Safety Mode in Hindi, on a phone**                             |

### Dark theme

The app has day and night themes. It follows the phone's setting, or you can pick one with the switch in the header.

|                                                                                    |                                                                                                   |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| ![Landing page, night theme](docs/screenshots/dark-hero.png) **Landing page**      | ![Analysis, night theme](docs/screenshots/dark-analysis.png) **Scam, 95, at night**               |
| ![Proof page, night theme](docs/screenshots/dark-proof.png) **Proof, night theme** | ![Telugu result, night theme](docs/screenshots/lang-te-analysis-dark.png) **Telugu job scam, 75** |

### In Hindi, Telugu and Bengali

Every screen, reason and action is in English, हिन्दी, తెలుగు and বাংলা. The scam checks read all four languages and Hinglish.

|                                                                                                |                                                                                     |
| ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| ![Hindi result](docs/screenshots/lang-hi-analysis.png) **Hindi: electricity cut-off scam, 76** | ![Bengali landing page](docs/screenshots/lang-bn-home.png) **Bengali landing page** |

### On a phone

<table>
  <tr>
    <td align="center" width="25%"><img src="docs/screenshots/mobile-analysis.png" alt="Hindi result on a phone" width="200" /><br /><b>Hindi: Scam, 95</b></td>
    <td align="center" width="25%"><img src="docs/screenshots/mobile-bn.png" alt="Bengali result on a phone" width="200" /><br /><b>Bengali: courier fee scam, 95</b></td>
    <td align="center" width="25%"><img src="docs/screenshots/mobile-te-dark.png" alt="Telugu result on a phone, night theme" width="200" /><br /><b>Telugu, night: "sent by mistake", Suspicious 60</b></td>
    <td align="center" width="25%"><img src="docs/screenshots/mobile-hi-dark-sos.png" alt="Hindi emergency help on a phone, night theme" width="200" /><br /><b>Hindi, night: SOS, call 1930</b></td>
  </tr>
</table>

---

## 9. Run it locally

> **Fastest way to look around:** text checks need **no keys and no backend**. `npm install && npm run dev` is enough.

### 9.1 Prerequisites

- Node.js 22 or later and npm
- Python 3.11 (only to retrain the model)
- Optional free accounts: [Groq](https://console.groq.com), [Google AI Studio](https://aistudio.google.com), [Upstash](https://upstash.com)

```bash
git clone https://github.com/Vidur-2007/AkshiRakshak.git
cd AkshiRakshak
npm install
npm run dev          # web app + local API (app: http://localhost:5173, API: http://localhost:3001/api)
```

### 9.2 Environment variables (optional)

Copy `.env.example` to `.env` (never commit `.env`):

| Variable                                | Needed for                        | Notes                                                                                                                              |
| --------------------------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `GROQ_API_KEY`, `GROQ_MODEL`            | AI second opinion, Ask rewrite    | A Groq model with JSON-schema output, e.g. `openai/gpt-oss-20b`                                                                    |
| `GEMINI_API_KEY`, `GEMINI_MODEL`        | Fallback AI provider              | A Flash or Flash-Lite model                                                                                                        |
| `GEMINI_VISION_MODEL`                   | Screenshot transcription (opt-in) | Image-capable; can equal `GEMINI_MODEL`                                                                                            |
| `KV_REST_API_URL` + `KV_REST_API_TOKEN` | Community report counts           | Or `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`. Without them `/api/reports` answers 503 and the app works without counts |
| `TELEGRAM_WEBHOOK_SECRET`               | Telegram bot (optional)           | The bot token is used only by `npm run telegram:setup` on your own machine; it is never stored in the repo or on the server        |
| `PORT`                                  | Local API server                  | Default `3001`                                                                                                                     |

A provider is used only when both its key and its model are set. `/api/health` shows which are configured, never the values.

### 9.3 Commands

```bash
npm test                    # all unit and component tests (Vitest)
npm run typecheck           # TypeScript, all packages
npm run lint                # ESLint
npm run eval                # evaluate on the test split, writes the Proof page report
npm run build -w @akshi/web # production build of the web app
npm run smoke -- https://akshi-rakshak.vercel.app   # check a deployment
npx playwright test -c apps/web                     # end-to-end, accessibility and performance
```

### 9.4 Retraining the model (optional)

```bash
cd ml
python3.11 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python -m akshi_ml.build_dataset   # data/messages/messages.jsonl
.venv/bin/python -m akshi_ml.train           # packages/model/model/scam-model.json
.venv/bin/python -m akshi_ml.parity          # fixtures for the TypeScript parity test
.venv/bin/python -m pytest
```

### 9.5 Deploy

Vercel (Hobby plan): import the repository, framework "Other", root directory = repository root. `vercel.json` sets the install and build commands, output folder, API functions and security headers. Add the environment variables above for Production and Preview, and optionally connect Upstash Redis from the Vercel Marketplace. Then run `npm run smoke -- https://<project>.vercel.app`.

### 9.6 Troubleshooting

| Problem                                                      | What to do                                                                                                                    |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `npm install` complains about the engine, or the build fails | Check `node -v`. You need Node.js 22 or later.                                                                                |
| The local API won't start: port in use                       | Something else is on port 3001. Set `PORT` in `.env`, or stop the other process.                                              |
| No AI second opinion                                         | Expected without keys. Text checks still work. Open `http://localhost:3001/api/health` to see which providers are configured. |
| `/api/reports` answers 503                                   | Expected without Upstash. The app works without report counts.                                                                |
| Screenshot check is slow the first time                      | The OCR language file (0.5–2 MB per language) downloads on first use, then they are cached and work offline.                  |
| Playwright tests fail to launch a browser                    | Run `npx playwright install chromium`. The Edge project runs only when Microsoft Edge is installed.                           |
| The full test run times out on a slow laptop                 | Run one project at a time, e.g. `npx vitest run --project web`, or rerun the failing file on its own.                         |

---

## 10. Demo walkthrough

**Watch first:** the [5-minute demo video on YouTube](https://youtu.be/FD6xtVlQ9hk) walks through the main checks.

No accounts needed. Open [akshi-rakshak.vercel.app](https://akshi-rakshak.vercel.app), or [`/tour`](https://akshi-rakshak.vercel.app/tour) for a 60-second guided tour. `/?demo=1` resets to a clean demo state.

### Try these (5 minutes)

1. **Fake KYC SMS:** `/scan` → sample **Fake KYC SMS** → **Scam, 95**. Tap the underlined words, read "Claims to be vs actually is", Scam Replay and "You're not the only one".
2. **Collect request:** `/modules/collect?sample=refund` → **Check this request** → **Scam, 95**, and the PIN explainer.
3. **Refund QR:** `/modules/qr-link` → **Refund QR** → **Scam, 85**: what the QR really pays.
4. **Telugu screenshot:** switch to **తె**, `/scan` → sample screenshot **తెలుగు ఉద్యోగ SMS** → the text is read on the device, then the verdict in Telugu.
5. **Disguised text:** paste `Your SBI acc0unt will be bl0cked t0day. Update KYC at http://sbi-kyc-update.xyz and sh@re the O.T.P n0w.` → still **Scam, 95**.
6. **Statement:** `/modules/transactions` → **College student (sample)** → bursts of small payments, a ₹1 credit then ₹9,999 out, linked to scams.
7. **Elder mode:** tap **Aa**, switch to **हि**, scan the **Electricity cut-off (Hindi)** sample → full-screen **रुकिए** (STOP), read aloud.
8. **Offline:** turn the network off and scan again → same answer.
9. **SOS:** tap **SOS** → "Did money leave your account?" → **Yes** → call 1930 first.

All sample messages, statements, numbers, UPI IDs and links are **synthetic** and were made for this project.

---

## 11. Privacy, safety and responsible AI

- **On the device:** text, screenshots and statements are checked in the browser. Nothing is uploaded for a normal check.
- **Masked before any AI:** the optional AI second opinion receives text only after phone numbers, UPI IDs, account numbers, emails, PAN and Aadhaar-like numbers are masked. Screenshot transcription by a cloud model is opt-in and asks first.
- **The AI can't take over:** it gets a fixed 20% share, can add at most 15 points, and an evidence guard drops AI claims the message doesn't support (made-up report counts, "verified", UPI IDs or links that aren't in the message).
- **Safety floors:** signals like "enter your PIN to receive" always give a Scam verdict, whatever the other layers say.
- **Truth rules in every screen:** never "safe"; "unverified", not "fake", unless there is a concrete mismatch; sample data labelled as sample data; no scam statistics without a source.
- **No accounts, no analytics scripts.** History, blocklist and feedback live in IndexedDB on the phone; "Delete everything" in Settings removes it all.
- **Community reports** (optional) send only the reported value (a UPI ID, number or link), never the message.
- **Hardened API:** rate limits, SSRF guard on link expansion, no message text in logs, security headers, input validation with zod.
- **Synthetic data only:** no real messages, names, bank details, PAN or Aadhaar numbers anywhere in the repository.

### What works offline

Once the app has loaded (it installs as a PWA), these keep working with no connection:

| Works offline                                                                   | Needs the internet                                                   |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Text checks: SMS, chats, emails, UPI IDs, phone numbers (rules + our own model) | AI second opinion (Groq, then Gemini)                                |
| Link checks on the text itself: lookalike brands, odd domains, shorteners       | Following a short link to where it really goes, and the domain's age |
| Screenshot OCR (after each language has been used once)                         | Cloud screenshot transcription (opt-in)                              |
| QR code decoding and the "what this QR really does" check                       | Community report counts (Upstash)                                    |
| Collect-request and payment checks                                              | Ask with AI rewriting (the offline FAQ guide is used otherwise)      |
| Bank-statement scan                                                             | The Telegram bot                                                     |
| History, blocklist, feedback, Dojo drills, SOS steps and the evidence report    | Calling 1930 or opening cybercrime.gov.in (your phone's network)     |

---

## 12. AI tools used

**To build the project**

| Tool                                | How we used it                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Claude** (Anthropic): Claude Code | Our AI development tool. We wrote a shared specification with Claude ([`docs/SPEC.md`](docs/SPEC.md) and one spec per part), then used Claude Code on three laptops, one per part (engine, web, data), each on its own branch, following phase-by-phase prompts ([`docs/PROMPTS_A_ENGINE.md`](docs/PROMPTS_A_ENGINE.md), [`docs/PROMPTS_B_WEB.md`](docs/PROMPTS_B_WEB.md), [`docs/PROMPTS_C_DATA.md`](docs/PROMPTS_C_DATA.md)). Progress logs for every phase are in [`docs/progress/`](docs/progress). |

Hindi, Telugu and Bengali text was drafted with AI help and is being reviewed by native readers ([`docs/i18n-review.md`](docs/i18n-review.md)). All AI-generated code was reviewed, run and tested by the team.

**Inside the product (runtime)**

| Tool                                            | How the product uses it                                  |
| ----------------------------------------------- | -------------------------------------------------------- |
| **Our own scam model** (scikit-learn, exported) | Scam probability and category, in the browser            |
| **tesseract.js**                                | Screenshot OCR on the device                             |
| **Groq** (open LLMs)                            | Optional second opinion; rewriting Ask answers           |
| **Google Gemini**                               | Fallback second opinion; opt-in screenshot transcription |

---

## 13. Limitations and future work

**Honest limitations**

- **Synthetic data.** The training and test data are template-generated. Real messages are messier, so expect lower numbers. A team-written test set ([`data/handwritten/`](data/handwritten)) is prepared but not yet filled in.
- **Weak spots.** Romance scams (3 of 9 caught) and phishing links (10 of 15). A disguised message _without_ a link scores lower (Suspicious rather than Scam).
- **Sample indicators.** The known-scam numbers, UPI IDs and links are sample data, not a live fraud feed.
- **OCR quality.** On-device OCR depends on the screenshot; complex Telugu and Bengali conjuncts are sometimes misread. When a read is weak, the app asks you to correct the text.
- **Browser voices.** Read-aloud depends on the voices installed on the device.
- **Optional services.** Community report counts need Upstash; the Telegram bot is switched off until it is set up.

**Next steps**

- Measure on real, consented messages, and fill in the team-written test set.
- A live, verified indicator feed (with signed updates) instead of sample data.
- More languages (Tamil, Kannada, Marathi and others), with native-speaker review.
- Android share-to-check and SMS integration, and a WhatsApp channel through an approved provider.
- Use the "Was Akshi right?" labels (with consent) to find false alarms and misses for the next model.

---

## 14. Repository structure

```
AkshiRakshak/
├─ apps/web/                React web app (PWA)
│  ├─ src/pages/            Scan, Analysis, modules, Network, Learn, SOS, Proof, Settings
│  ├─ src/components/       analysis, scan, modules, statements, elder, shell, ui
│  ├─ src/lib/              engine bridge, IndexedDB, i18n, store, campaign match, replay
│  ├─ src/locales/          en, hi, te, bn
│  ├─ public/samples/       sample screenshots (synthetic)
│  └─ e2e/                  Playwright: smoke, accessibility, performance, tour
├─ packages/contracts/      shared types and zod schemas
├─ packages/engine/         detection engine: rules, lexicons, links, UPI, OCR, fusion, story
├─ packages/model/          exported scam model, calibration and TypeScript inference
├─ packages/insights/       bank-statement parser and anomaly detection
├─ packages/content/        drills, FAQ, emergency steps, samples, eval report, calibration
├─ api/                     Vercel Functions: analyze, AI, ask, expand, domain age, reports, telegram
├─ eval/                    evaluation harness (npm run eval), reliability, error listing
├─ ml/                      Python: dataset generator, validator, training, parity
├─ data/                    templates, fillers, generated messages, sample statements, handwritten set
├─ scripts/                 dev API server, OCR assets, bundle size, smoke test, API build
└─ docs/                    specs, prompts, progress logs, dataset card, eval notes, demo script, screenshots
```

**Contributing.** Issues and pull requests are welcome. Please keep to the project rules: synthetic data only (no real messages, names, bank details, PAN or Aadhaar numbers), TypeScript strict, tests for new logic, `npm run typecheck && npm test && npm run lint` before a PR, and short conventional commit messages. Tune detection only on the validation split, never on the test or handwritten sets.

**Credits.** Emergency steps point to the National Cyber Crime Reporting Portal (cybercrime.gov.in, helpline 1930) and Sanchar Saathi Chakshu (sancharsaathi.gov.in). OCR trained data from [tesseract-ocr/tessdata_fast](https://github.com/tesseract-ocr/tessdata_fast). Full list of open-source packages: see the `package.json` files and `ml/requirements.txt`.

**Licence:** [MIT](LICENSE)

---

<div align="center">

Built for **Arthaton 2026** by **Maximus Decimus Meridius**.

_Akshi Rakshak: the eye that protects._

</div>
