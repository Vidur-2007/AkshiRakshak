# Language review checklist

Every Hindi, Telugu and Bengali string in Akshi Rakshak was drafted with AI help, and none has been checked by a native reader yet. The app is meant for people who are being rushed and scared by a scammer, often older people, so the wording has to be right. This page lists every localised file in the repo, grouped by language, so the work can be split up and tracked.

## How to review

**What good looks like**
- **Plain, everyday words.** Write it the way you would say it to a parent or a neighbour. Prefer "पैसे" to "धनराशि", "బ్యాంక్ ఖాతా" to a formal coinage, "টাকা" to a literary word. English loanwords people actually use (OTP, PIN, UPI, KYC, link, app, refund) should stay in English or in the usual transliteration.
- **Correct script.** Hindi in Devanagari (romanised Hindi only where the file is the Hinglish lexicon), Telugu in Telugu script, Bengali in Bengali script. No stray letters from another script, no English sentence left in a Hindi, Telugu or Bengali field.
- **Warnings an older reader understands at once.** Short sentences. Say what to do ("Do not enter your PIN", "Call 1930") before why. No jargon such as "phishing" or "remote access" without a plain explanation.
- **No literal translations that change the meaning.** Watch especially for:
  - "safe": the app never says a message is safe. The lowest verdict is "No warning signs found"; its translations must not read as "this is safe" or "this is genuine".
  - "PIN sends money": a PIN only ever sends money out, never brings it in. Any sentence that could be read as "enter your PIN to receive" is a serious bug.
  - negations ("the bank never asks for your OTP") must stay clearly negative.
  - numbers, amounts (₹ with Indian grouping: ₹1,00,000) and helplines (1930, cybercrime.gov.in, sancharsaathi.gov.in) must be unchanged.
- **Consistent terms** across the app: pick one word for "scam", "suspicious", "collect request", "UPI ID" per language and use it everywhere.

**What to send back.** For each problem: the file, the key or id (or the first few words), the current text, your suggested text, and one line on why. Send it to the laptop that owns the file (last column below); do not edit another laptop's files yourself. Rule and lexicon files decide what the engine detects, so for those, also say if a phrase scammers really use is missing.

**How to mark progress.** Put your name in the Reviewer column and set Status to `in review`, then `done` (or `done with changes sent`).

## Who reviews what

Each team member reviews the language they read best; a second reader is welcome for anything shown on the main analysis screen.

| Language | Suggested reviewer | Priority files |
|---|---|---|
| Hindi (Devanagari and Hinglish) | the team member most at home in Hindi | engine strings, web locale, drills, emergency steps |
| Telugu | the team member who reads Telugu | engine strings, web locale, drills, emergency steps |
| Bengali | the team member who reads Bengali | engine strings, web locale, emergency steps, FAQ |

The human on each laptop fills in the names.

## Checklist

### Hindi

| File | What it is | Size | Owner | Reviewer | Status |
|---|---|---|---|---|---|
| `packages/engine/src/i18n/hi.json` | Verdicts, signal labels and reasons, explanations, actions shown on every result | 25 KB | A | | not started |
| `packages/engine/src/rules/lexicons/hi.json` | Devanagari scam phrases the rules match | 14 KB | A | | not started |
| `packages/engine/src/rules/lexicons/hi-latn.json` | Romanised Hindi (Hinglish) scam phrases | 7 KB | A | | not started |
| `apps/web/src/locales/hi.json` | All web app screens, buttons, onboarding, settings | 61 KB | B | | not started |
| `packages/content/src/emergency.ts` (`hi`) | "I've been scammed" questions, steps and evidence checklist | — | C | | not started |
| `packages/content/src/faq.ts` (`hi`) | 33 questions and answers for Ask Akshi | — | C | | not started |
| `packages/content/src/drills.ts` (second field of each `[en, hi, te]`) | 10 Scam Dojo chat drills: messages, choices, feedback, endings | — | C | | not started |
| `packages/content/src/patterns.ts` (`hi`) | 8 "how this scam works" cards | — | C | | not started |
| `packages/content/src/samples.json` (`label.hi`, Hindi sample texts) | "Try a sample" labels and three Hindi sample messages (one in Hinglish) | — | C | | not started |
| `packages/insights/src/strings.ts` (`hi`) | Statement-check titles, explanations, feature names, summary | — | C | | not started |
| `data/templates/**/*-hid-*.yaml`, `*-hir-*.yaml` | Training templates (affect the model, not shown in the app) | — | C | | not started |

### Telugu

| File | What it is | Size | Owner | Reviewer | Status |
|---|---|---|---|---|---|
| `packages/engine/src/i18n/te.json` | Verdicts, signal labels and reasons, explanations, actions | 27 KB | A | | not started |
| `packages/engine/src/rules/lexicons/te.json` | Telugu scam phrases the rules match. **Known issue:** phrases match inside "the bank never asks for your PIN / is not needed" notices (see `docs/eval-notes.md`); please also suggest the common negation endings (అడగదు, అడగరు, అవసరం లేదు, …) | 13 KB | A | | not started |
| `apps/web/src/locales/te.json` | All web app screens | 66 KB | B | | not started |
| `packages/content/src/emergency.ts` (`te`) | Emergency questions, steps, evidence checklist | — | C | | not started |
| `packages/content/src/faq.ts` (`te`) | 33 FAQ items | — | C | | not started |
| `packages/content/src/drills.ts` (third field of each `[en, hi, te]`) | 10 drills | — | C | | not started |
| `packages/content/src/patterns.ts` (`te`) | 8 pattern cards | — | C | | not started |
| `packages/content/src/samples.json` (`label.te`, Telugu sample texts) | Sample labels and two Telugu sample messages | — | C | | not started |
| `packages/insights/src/strings.ts` (`te`) | Statement-check text | — | C | | not started |
| `data/templates/**/*-te-*.yaml` | Training templates | — | C | | not started |

### Bengali

| File | What it is | Size | Owner | Reviewer | Status |
|---|---|---|---|---|---|
| `packages/engine/src/i18n/bn.json` | Verdicts, signal labels and reasons, explanations, actions | 26 KB | A | | not started |
| `packages/engine/src/rules/lexicons/bn.json` | Bengali scam phrases the rules match. **Known issue:** most test false alarms are Bengali genuine bank messages; please check for words that are too general | 12 KB | A | | not started |
| `apps/web/src/locales/bn.json` | All web app screens | 61 KB | B | | not started |
| `packages/content/src/emergency.ts` (`bn`) | Emergency questions, steps, evidence checklist | — | C | | not started |
| `packages/content/src/faq.ts` (`bn`) | 33 FAQ items | — | C | | not started |
| `packages/content/src/patterns.ts` (`bn`) | 8 pattern cards | — | C | | not started |
| `packages/content/src/samples.json` (`label.bn`, Bengali sample texts) | Sample labels and two Bengali sample messages | — | C | | not started |
| `packages/insights/src/strings.ts` (`bn`) | Statement-check text | — | C | | not started |
| `data/templates/**/*-bn-*.yaml` | Training templates | — | C | | not started |

Drills are in English, Hindi and Telugu only; Bengali drills are not planned for the hackathon.

### English (source text, for clarity rather than translation)

| File | Owner | Reviewer | Status |
|---|---|---|---|
| `packages/engine/src/i18n/en.json` | A | | not started |
| `apps/web/src/locales/en.json` | B | | not started |
| `packages/content/src/*.ts`, `samples.json` (`en`) | C | | not started |
| `packages/insights/src/strings.ts` (`en`) | C | | not started |

## Order of work

If time is short, review in this order: engine strings (every result screen), emergency steps, web locale for the scan and result screens, drills, FAQ, pattern cards, statement text, then templates and lexicons. Lexicon suggestions go to A as a list of phrases with the scam type they belong to.
