# Demo script and submission checklist

Video target **4:30** (hard limit under 5:00), following the timeline in SPEC.md §13.1. Every input below is bundled in the app or written out here, and every verdict and score was checked against the engine on `feat/data` (engine 0.3.0 with A's Phase 4 fixes, model 2026.11.18-a, tuned calibration) on 2026-11-18, offline. If a number on screen differs on recording day, read what the screen says, not this page.

## Roles

| Who | Does |
|---|---|
| Laptop B's human | Records the desktop screen (B's recording checklist in `docs/progress/web.md`: Chrome 1280×800, zoom 100%, notifications off, open `/?demo=1` once online first) |
| Laptop A's human | Records the phone shots (the screenshot upload, optionally the airplane-mode shot on a real phone) |
| Laptop C's human | Narrates (records voice separately; easier to retake), checks timings, owns this page |
| All three | Watch the cut once against the truth rules below before uploading |

Swap roles freely; the narrator should be the clearest speaker of English with one Hindi and one Telugu line.

## Truth rules for the narration (SPEC.md §1.3)

- Never say "safe". The lowest verdict is **"No warning signs found"**.
- Every number we say is our own measurement and we say where it comes from: "on our synthetic test set". No outside statistics.
- Sample statements and indicator counts are **sample data**; say "a sample statement".
- Say once that the model was trained on synthetic data.

## Before recording

1. App running with all three branches merged (deployed URL, or locally: `npm install`, `npm run build`, `npm run preview -w @akshi/web`; for the API, `npm run dev:api`).
2. Open `/?demo=1` once while online, wait about 10 seconds for the offline cache, then reload.
3. **Telugu screenshot (shot 5).** No phone needed: `/scan` (and the Messages page) has **Sample screenshots**. **Telugu job SMS** is a made-up phone screenshot of this message:
   > హలో! ఇంటి నుండే పార్ట్ టైమ్ ఉద్యోగం. యూట్యూబ్ వీడియోలకు లైక్ చేస్తే రోజుకు ₹2,000 సంపాదించండి. మొదటి టాస్క్ కోసం ₹500 నమోదు రుసుము చెల్లించండి.

   Tapping it runs the real on-device OCR (Telugu + English, whatever the UI language). Checked 2026-11-22: **Scam, 74**, part-time task job (ADVANCE_FEE, TASK_JOB_PAYMENT). The first OCR of a session takes about 10 seconds while the reader loads, so tap it once before recording. The other two samples: **Bank KYC SMS** (Scam 95) and **Chat asking for OTP** (Scam 92, screen-sharing scam).

4. Volume on (Hindi voice in shot 7). In Settings, add an invented family contact (e.g. "Amma", 98765 00000) so Elder mode shows **Call my family**. Do not show any real phone number, name or notification on screen.

## Shot list and narration

| # | Time | Length | Screen and route | Exact input | What should appear (checked) |
|---|---|---|---|---|---|
| 1 | 0:00–0:20 | 20 s | Desktop, `/` landing | Type into the hero box: `Your SBI account will be blocked today. Update KYC and share the OTP` | Live meter climbs while typing to **61, Suspicious** (amber). The full scan in shot 2 is where red appears. |
| 2 | 0:20–1:10 | 50 s | Desktop, `/scan` | Tap the first sample chip, **Fake KYC SMS** (`sample-fake-kyc`) | **Scam, 95**, fake KYC. Highlights on "BLOCKED today" and the link; claims vs reality (claims to be SBI, link is `sbi-kyc-update.xyz`); signals: known indicator, lookalike domain, brand mismatch, threat to block. Open "How we decided". |
| 3 | 1:10–1:50 | 40 s | Desktop, `/modules/collect?sample=refund` | Prefilled: SBI Refund Desk, `sbi.refund.desk@ybl`, ₹5,000, "Refund of Rs 5,000", told you will receive: yes | **Scam, 95**, UPI collect. Then the PIN-pad explainer. |
| 4 | 1:50–2:20 | 30 s | Desktop, `/modules/qr-link` | QR sample (`upi://pay?pa=refund.desk@ybl&pn=SBI%20Refund%20Desk&am=4999…`), then the link sample `http://sbi-kyc-update.xyz/verify?id=88213` | QR: **Scam, 85** (QR to receive, name vs handle mismatch, personal handle, prefilled amount). Link: **Scam, 95**, URL anatomy with the lookalike domain and risky TLD. |
| 5 | 2:20–2:50 | 30 s | Desktop or phone, `/scan`; header language **Telugu** | Sample screenshot **Telugu job SMS** (తెలుగు ఉద్యోగ SMS) | OCR progress, then boxes over the text and the verdict in Telugu: **Scam, 74**, part-time task job. |
| 6 | 2:50–3:20 | 30 s | Desktop, `/modules/transactions` | Sample statement **College student (sample)** | Two cards: "Many payments in a few minutes" (4 × ₹499 to a new payee) and "Large payment to someone new" (₹1 credit, then ₹9,999 at 23:40). Open "why unusual" on one. |
| 7 | 3:20–3:45 | 25 s | Desktop, header **Aa** (Elder mode) on, language **Hindi**, voice on, `/scan` | Sample **Electricity cut-off (Hindi)** (`sample-electricity-hi`) | Full-screen **STOP**, spoken in Hindi (**Scam, 76**, bill disconnection), with **Call my family** (set an invented family contact in Settings beforehand). Open the details and tap **Warn family** for the share card. |
| 8 | 3:45–4:10 | 25 s | Desktop: Wi-Fi off (or DevTools → Network → Offline), language English, Elder mode off; then Wi-Fi on, `/proof` | Fake KYC SMS sample again | "Offline" pill, same **Scam, 95**. Then Proof: F1 95.7%, false alarms 2.9% on the synthetic test set, the by-language table. |
| 9 | 4:10–4:30 | 20 s | Desktop, `/sos` | Answer the first question, "Did money leave your account?", with **Yes** | Emergency steps with **call 1930** first and cybercrime.gov.in; end on the tagline. |
| | | **4:30** | | | |

### Narration

**1 — Landing (0:00).**
"Every day, people in India get messages like this one. Watch the meter as I type: an account threat, a bank name, a request for the OTP. Akshi Rakshak, the eye that protects, reads it as you type."

**2 — Quick Scan (0:20).**
"Here's the full message, the way it arrives by SMS. One tap. Scam, ninety-five out of a hundred, in about a second. It shows exactly which words gave it away: the deadline, and the link. It says the message claims to be SBI, but the link isn't SBI's. And this panel shows how it decided: hand-written rules in four languages, a machine-learning model that runs inside the browser, and link checks. Nothing was uploaded."

**3 — Collect request (1:10).**
"The most common UPI trick: a 'refund' that's really a collect request. The app shows 'Pay', and your PIN sends money out. Akshi Rakshak says Scam, and this explainer shows why: a PIN only ever sends money. You never need it to receive."

**4 — QR and link (1:50).**
"Same idea in a QR code: a 'refund' QR with the amount already filled in and a personal UPI handle pretending to be a bank desk. And this link: it looks like SBI, but the real domain is a lookalike on a risky ending. Each part of the address is explained."

**5 — Telugu screenshot (2:20).**
"Scams don't only come in English. Here's a screenshot of a Telugu job offer: like videos, earn two thousand a day, just pay a five-hundred-rupee fee first. The text is read on the device, and the answer comes back in Telugu."
*Telugu moment, as the verdict appears:* "ఇది మోసం. ఉద్యోగం కోసం ఎప్పుడూ డబ్బు కట్టకండి." ("This is a scam. Never pay money for a job.")

**6 — Statement (2:50).**
"It also checks a bank statement, again without uploading it. On this sample statement it finds four quick payments of four hundred and ninety-nine rupees to someone new, the pattern of a task scam, and a one-rupee credit followed by almost ten thousand going out late at night. Each card says why it's unusual for this person."

**7 — Elder mode (3:20).**
"For our parents and grandparents there's Elder mode: one big answer, spoken aloud in their language."
*Hindi moment, over the STOP screen:* "रुकिए। यह ठगी है। किसी को पैसे या PIN मत दीजिए।" ("Stop. This is a scam. Don't give anyone money or your PIN.")
"And one tap warns the family."

**8 — Offline and proof (3:45).**
"Now I turn the internet off. Same message, same answer: text checks work fully offline. And we measured it. On our held-out synthetic test set of five hundred and twenty-seven messages, the full system scores an F1 of ninety-five point seven percent, with false alarms on two point nine percent of genuine messages. The training data is synthetic, and every number, including the weak spots, is on this page."

**9 — Emergency (4:10).**
"And if it's already happened, Emergency mode tells you what to do first: call 1930, then report on cybercrime.gov.in. Akshi Rakshak. The eye that protects."

## Backup plan

- **AI provider rate-limited or down:** nothing in the script needs the AI second opinion; every verdict above was checked offline. If an "AI" pill shows an error, cut it or record that shot with Wi-Fi off. Never wait on a spinner on camera.
- **No deployed URL:** record on `localhost` (see "Before recording"); say "the app" rather than reading out a URL.
- **OCR misreads the Telugu screenshot:** retake with a larger font and plain background; if it still fails, paste the same Telugu text into the scan box and say "here's the same message as text".
- **A score differs on the day:** read the screen's number; keep "Scam" / "Suspicious" wording as shown.
- **Over time:** trim shot 4 to the link only (−10 s) and shot 6 to one card (−10 s).
- **Fallback for judges:** the 60-second tour runs everything offline at `/tour?start=1`.

## Submission checklist

Deadline: **22 November 2026, 23:59 IST**, through the emailed submission link (team lead submits).

| # | Item | Status (2026-11-18) |
|---|---|---|
| 1 | Public GitHub repository with all source code | ☐ Check the repo is **public** before submitting. All three branches merged to `main` (PR #3 first, then #2, then B's). |
| 2 | README explains what the app does and how to run it | ☑ Written. ☐ Fill in the TODOs: live URL, video link, screenshots, team names. |
| 3 | README credits every open-source library and AI API | ☑ Groq, Gemini, Vercel AI SDK, tesseract.js and tessdata_fast, scikit-learn and the rest, from every `package.json` and `ml/requirements.txt`. ☐ Recheck if any dependency is added after 2026-11-18. |
| 4 | No API keys or secrets in the repo or history | ☑ Searched all branches and history: no Groq / Google / OpenAI / GitHub / Slack key patterns, no `*_KEY=`, `TOKEN=` or `SECRET=` values, no private keys, no Upstash URLs; only `.env.example` (empty values) was ever committed; `.env` is gitignored. |
| 5 | No real bank details, PAN, Aadhaar or personal data | ☑ Every 10–16-digit number in the tree was checked: generated reference numbers (12 digits starting 0 or 1), the invented `98765 0/1` and `90000 0` phone prefixes, standard test values (4111 1111 1111 1111, sequential digits) in tests, and constants (2³², an FNV seed, 127.0.0.1 as an integer, a git commit prefix). One plausible-looking mobile number used as a validator test input was replaced with 9999999999 (it remains in older commits as a test literal). No email addresses in the tree. ☐ Recheck after the handwritten CSVs are added. |
| 6 | Demo video under 5 minutes | ☐ Record with this script (target 4:30). Upload (YouTube unlisted or Drive "anyone with the link") and test the link in a private window. |
| 7 | Live URL works on a phone | ☐ Not deployed yet (A's log). After Merge 2: Vercel project, env vars, `npm run smoke -- <url>`, then open on an Android phone: scan, collect, QR camera, screenshot upload, airplane mode. |
| 8 | Handwritten test set measured | ☐ Waiting for the team's CSVs (`data/handwritten/`, then `python -m akshi_ml.handwritten`, then `npm run eval`). Report it as it comes out, even if lower. |
| 9 | Submit GitHub link and video link | ☐ Team lead, before 22 Nov 23:59 IST. |
