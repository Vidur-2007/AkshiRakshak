# Dataset card — Akshi Rakshak messages

Version: Phase 1 (2026-11-16). File: `data/messages/messages.jsonl`. Numbers below come from `data/messages/stats.json`, which `python -m akshi_ml.build_dataset` rewrites on every build.

## Purpose

Train and evaluate a small text classifier that flags scam messages aimed at Indian UPI users, in English, Hindi (Devanagari and romanised Hinglish), Telugu and Bengali, and that does not flag the genuine bank, shop, courier and government messages people receive every day.

## Data safety rules

- All rows are synthetic (generated from templates written for this project) or handwritten by the team. No scraped or forwarded personal messages.
- Every phone number, UPI ID, link and name in a scam row is invented. Phone numbers use the placeholder prefixes `98765 0`, `98765 1` and `90000 0`. Scam domains come only from `data/fillers/scam_domains.yaml`; they are strings and are never opened, even if one happens to exist.
- No Aadhaar, PAN, card or account numbers, real or real-looking. Account numbers appear only masked (`XX1234`). Reference numbers are 12 digits starting with 0 or 1, which an Aadhaar number cannot be.
- Names are common first names with common surnames in invented combinations; they do not refer to real people.
- `validate.py` enforces these rules on every row, and the build writes nothing if a row fails.
- Genuine-style rows link only to official domains (the same list the engine treats as official).

## Scam taxonomy

How each of the 19 categories reads in India, and the signs that give it away. These descriptions come from how the scams are commonly described in public awareness material and news reporting; they are qualitative only. No statistics appear here unless a source URL is given.

**upi_collect — "refund" collect requests.** Someone (a buyer, a "refund desk", a "cashback team") says money is coming and sends a UPI collect request, asking you to accept and enter your PIN "to receive" it. Signs: any request to enter a UPI PIN to receive money; a collect request from an unknown handle; pressure to approve quickly.

**qr_receive — QR "to receive" money.** Common on marketplace listings (OLX-style): a "buyer" sends a QR code and says scanning it will credit the payment. Signs: a QR code offered for receiving money; a prefilled amount; a buyer who agrees to any price without seeing the item, often claiming to be in the army or posted far away.

**fake_kyc — KYC expiry and account block.** SMS or WhatsApp saying your bank account, YONO/net banking or PAN link will be blocked today unless you update KYC through a link or a number. Signs: same-day deadline, account-block threat, a link that is not the bank's official domain, a 10-digit sender instead of a bank header.

**bill_disconnection — electricity or gas cut tonight.** "Your electricity will be disconnected at 9:30 PM tonight because last month's bill was not updated, call the electricity officer at …". Signs: a specific time tonight, a personal mobile number for an "officer", no consumer number, a request to install an app or pay a small amount to "update".

**digital_arrest — fake police / CBI on video call.** A caller claiming to be police, CBI, customs, TRAI or a court says your Aadhaar, SIM or a parcel is linked to drugs or money laundering, keeps you on a video call for hours, forbids you to tell family, and asks you to move savings to a "safe" or "RBI verification" account. Signs: video-call "arrest", secrecy, threats of immediate arrest, money transfers to clear your name. No Indian agency arrests or settles cases over a video call.

**courier_customs — parcel held, pay a fee.** A courier, India Post or "customs" message says a parcel is held for an incomplete address or customs duty and asks for a small fee or address update through a link. Signs: unexpected parcel, small payment through a non-official link, threats that the parcel will be returned or seized.

**job_task — part-time task jobs.** "Earn ₹3,000 a day liking YouTube videos / rating hotels." Early tasks pay small amounts, then you are moved to a Telegram group and asked to "invest" or pay to unlock higher tasks or withdraw. Signs: easy money for likes or reviews, a joining or task fee, Telegram handles, pressure to deposit more to withdraw.

**investment_crypto — guaranteed returns.** WhatsApp or Telegram "stock tips" groups, fake IPO allotment, crypto doubling. Signs: guaranteed or very high returns, "VIP" groups, apps not from a known broker, fake profit screenshots, pressure to add funds before withdrawal.

**loan_app — instant loans and harassment.** Instant loan offers with no documents that ask for a processing fee or for contacts and gallery access, followed by harassment. Signs: upfront fees, unknown app names, APK links instead of a store listing, threats to contact family.

**lottery_prize — you have won.** KBC lottery, "lucky draw winner", brand anniversary gifts. Signs: a prize you never entered for, a "tax" or "processing fee" to release it, WhatsApp numbers instead of official channels.

**fake_customer_care — numbers from search results.** Someone searching for a bank, airline or app helpline calls a fake number; the "agent" asks for card details or OTP, or for a screen-sharing app. Signs: a customer-care number from a search result or social post, requests for OTP/PIN/CVV, a request to install an app.

**refund_cashback — refunds that need you to act.** Income-tax, GST, order or electricity refunds "pending" until you click a link, share details or approve a request. Signs: unexpected refund, a link or a collect request to "receive" it, deadlines.

**wrong_transfer — "sent by mistake, please return".** A credit (sometimes a fake SMS, sometimes a real small credit) followed by a call asking you to return a larger amount. Signs: an urgent request to send money back, often to a different UPI ID; a fake credit SMS without a matching bank balance.

**malicious_apk — install this file.** A wedding invitation, traffic challan, PM scheme or "bank security update" sent as an `.apk` file. Installing it gives the scammer access to SMS and OTPs. Signs: an `.apk` attachment or link outside the Play Store, urgency, a known contact's hacked account.

**remote_access — screen-sharing apps.** The caller asks you to install AnyDesk, TeamViewer QuickSupport or a similar app "to fix" a refund, KYC or account problem, then watches or controls the screen while you open your bank app. Signs: any request to install a screen-sharing app or read out a code it shows.

**otp_theft — just tell me the OTP.** A caller or message asks for the OTP you "just received" to verify, refund, deliver or unblock something. Signs: anyone asking for an OTP. Banks and services never ask for it.

**romance — friendship turned money request.** A new online friend or match builds trust over weeks, then needs money for a medical emergency, customs fee for a gift, or an investment opportunity. Signs: a contact you have never met in person asking for money, gifts held at customs, refusal to video call.

**impersonation_govt — fake government schemes and notices.** Fake PM Kisan, scholarship, e-challan, EPFO or income-tax notices asking for a fee, details or an app install. Signs: domains that are not `gov.in`, small "processing" fees, links to APKs.

**phishing_link — fake login pages.** Messages with links to look-alike bank or brand pages (`sbi-kyc-update.xyz`, `0nlinesbi-login.help`) that collect login details, card details or OTPs. Signs: look-alike spellings, odd TLDs, shortened links, a login page reached from a message.

## Hard negatives (genuine messages that look risky on the surface)

Bank OTP SMS with "do not share", debit and credit alerts, UPI payment confirmations, delivery updates from courier and e-commerce domains, utility bill reminders that point to the official site or app, bank promotional SMS, government scheme notifications on `gov.in` domains, appointment reminders. They mention OTPs, banks, amounts and links, so they teach the model that those words alone are not a scam.

## Sizes

**Current (Phase 4, 2026-11-18):** 3,579 rows in 250 template families (990 templates): 1,739 scam and 1,840 genuine. 76 families were added after error analysis on the validation split: a second scam family for every category in Telugu and Bengali, a second Hindi family for the eight weakest categories, an English "guaranteed daily returns" family, and genuine Telugu, Bengali, Hindi and English hard negatives (bank fraud-awareness notices that use the scam words, FD/SIP/loan offers, credits, card alerts, EMIs, refunds, telecom, family chats, genuine investment adverts). No earlier row or split changed; new families were assigned by the same rules.

| Language | Label | Train | Val | Test | Total | Target (§3.2) |
|---|---|---:|---:|---:|---:|---:|
| en | scam | 292 | 86 | 88 | 466 | 450 |
| en | legit | 360 | 100 | 80 | 540 | 500 |
| hi | scam | 334 | 66 | 65 | 465 | 350 |
| hi | legit | 380 | 80 | 80 | 540 | 380 |
| te | scam | 308 | 42 | 54 | 404 | 200 |
| te | legit | 260 | 60 | 60 | 380 | 220 |
| bn | scam | 310 | 54 | 40 | 404 | 200 |
| bn | legit | 260 | 60 | 60 | 380 | 220 |
| **all** | | **2,504** | **548** | **527** | **3,579** | 2,520 |

- Families per split: 177 train, 37 validation, 36 test.
- Hard negatives: en 200, hi 300, te 200, bn 200 (900 of 1,840 genuine rows).
- Hindi: 41% romanised. Scripts: Latin 1,420, Devanagari 591, Telugu 784, Bengali 784. Channels: SMS 2,132, WhatsApp 1,073, call 228, Telegram 111, email 35.
- Every scam category now has 7 to 11 families and at least 72 rows.

**As of Phase 1** (kept for reference): 2,550 rows in 174 template families: 1,210 scam and 1,340 genuine. Every size target in SPEC_C_DATA.md §3.2 is met.

| Language | Label | Train | Val | Test | Total | Target (§3.2) |
|---|---|---:|---:|---:|---:|---:|
| en | scam | 278 | 86 | 88 | 452 | 450 |
| en | legit | 360 | 80 | 80 | 520 | 500 |
| hi | scam | 223 | 66 | 65 | 354 | 350 |
| hi | legit | 260 | 60 | 60 | 380 | 380 |
| te | scam | 140 | 32 | 30 | 202 | 200 |
| te | legit | 140 | 40 | 40 | 220 | 220 |
| bn | scam | 142 | 30 | 30 | 202 | 200 |
| bn | legit | 140 | 40 | 40 | 220 | 220 |
| **all** | | **1683** | **434** | **433** | **2550** | 2,520 |

- Hard negatives (inside the genuine rows): en 180, hi 140, te 80, bn 80 — 480 in total (targets 180 / 130 / 80 / 80).
- Hindi: 43% of rows are romanised (target at least 35%); the rest are Devanagari.
- Scripts: Latin 1,289, Devanagari 417, Telugu 422, Bengali 422.
- Channels: SMS 1,520, WhatsApp 826, call scripts 154, email 35, Telegram 15.

Scam rows by category (each of the 19 categories has at least 5 families and at least 40 rows; the six priority categories have 7 families):

| Category | Rows | Families | Train | Val | Test | en / hi / te / bn |
|---|---:|---:|---:|---:|---:|---|
| upi_collect | 89 | 7 | 59 | 15 | 15 | 45 / 20 / 12 / 12 |
| qr_receive | 52 | 5 | 28 | 14 | 10 | 14 / 18 / 10 / 10 |
| fake_kyc | 89 | 7 | 69 | 10 | 10 | 45 / 20 / 12 / 12 |
| bill_disconnection | 89 | 7 | 69 | 10 | 10 | 45 / 20 / 12 / 12 |
| digital_arrest | 89 | 7 | 62 | 12 | 15 | 45 / 20 / 12 / 12 |
| courier_customs | 52 | 5 | 28 | 14 | 10 | 14 / 18 / 10 / 10 |
| job_task | 89 | 7 | 59 | 15 | 15 | 45 / 20 / 12 / 12 |
| investment_crypto | 52 | 5 | 29 | 9 | 14 | 14 / 18 / 10 / 10 |
| loan_app | 52 | 5 | 32 | 10 | 10 | 14 / 18 / 10 / 10 |
| lottery_prize | 52 | 5 | 33 | 9 | 10 | 14 / 18 / 10 / 10 |
| fake_customer_care | 52 | 5 | 32 | 10 | 10 | 14 / 18 / 10 / 10 |
| refund_cashback | 52 | 5 | 32 | 10 | 10 | 14 / 18 / 10 / 10 |
| wrong_transfer | 52 | 5 | 34 | 9 | 9 | 14 / 18 / 10 / 10 |
| malicious_apk | 52 | 5 | 33 | 10 | 9 | 14 / 18 / 10 / 10 |
| remote_access | 52 | 5 | 28 | 10 | 14 | 14 / 18 / 10 / 10 |
| otp_theft | 52 | 5 | 29 | 14 | 9 | 14 / 18 / 10 / 10 |
| romance | 52 | 5 | 34 | 9 | 9 | 14 / 18 / 10 / 10 |
| impersonation_govt | 52 | 5 | 29 | 14 | 9 | 14 / 18 / 10 / 10 |
| phishing_link | 89 | 7 | 64 | 10 | 15 | 45 / 20 / 12 / 12 |

## How it was generated

1. **Template families** (`data/templates/<category>/<family>.yaml`, genuine ones in `legit/`). Each family is one message pattern in one language and script, with 3 to 12 templates (735 in total) and slots for bank, brand, amount, link, phone, UPI ID, name, date, time, deadline, app and OTP. The templates were written by Claude Code from general knowledge of how these scams and genuine messages read in India. They are not copies of real messages.
2. **Slot fillers** (`data/fillers/`): 12 banks and 23 brands with their official domains, invented scam domains by theme, invented UPI IDs, placeholder phone prefixes, common names, and amount ranges per category.
3. **Variants** added at random by `generate.py`: all-caps and lower-case text, emoji, line breaks, spaced-out words ("O T P", "K.Y.C"), a digit for a letter in a brand name ("HDFC B4nk"), romanised Hindi spellings (aapka / apka, nahi / nhi), and short forms (account / a/c). Links, UPI IDs and phone numbers are never altered. Genuine SMS rows get line breaks only.
4. **Caps**: a family yields at most 25 rows (scam families 9 to 15, genuine families 20), and no template supplies much more than its even share of a family.
5. **Dedupe**: a row is dropped if it equals another row in any family once case, spacing, punctuation and emoji are ignored, or if its character 5-gram Jaccard similarity to a row of the same family is above 0.9.
6. **Validation**: schema, script and language agreement (share of letters per script; romanised Hindi must contain Hindi marker words and English must not), no real-looking identifiers, invented phone prefixes only, scam links only from the invented list, genuine links only to official domains, no mobile numbers in genuine rows.

Generation is seeded per family, so the same templates always give the same rows.

## Splits

`split.py` assigns whole families to train, validation or test, so near-identical rows never sit on both sides of a split. Families are divided inside each stratum (scam: the category; genuine: language plus the hard-negative flag), which puts every category, every language and hard negatives in all three splits.

- Families: 114 train, 30 validation, 30 test. Rows: 1,683 / 434 / 433 (66% / 17% / 17%). The target was 70 / 15 / 15; most scam categories have 5 families, and one family each for validation and test is already 20%.
- Assignments are stored in `data/messages/splits.json`. A family keeps its split for good; only new families are assigned. Adding data later never moves a row into or out of the test split.
- The handwritten test set (150 messages written by the team, `split: handwritten`) is added in Phase 4. It is never used for training or tuning.

## Known biases and limits

- **Synthetic phrasing.** Every row comes from a template written by an AI model, so wording is cleaner and less varied than real messages. Results on this data will be better than results on real messages; the handwritten set exists to show that gap.
- **The test split shares the generator.** Test families are unseen patterns, but they were written by the same author with the same fillers and variants as the training families.
- **Telugu and Bengali are thinner.** Since Phase 4 each has two scam families per category (3 or 4 templates each), against two or three English families. Telugu, Bengali and Hindi text was drafted by an AI model and has not yet been reviewed by a native reader (checklist: `docs/i18n-review.md`).
- **Parallel content across languages.** Many Hindi, Telugu and Bengali families cover the same scenario as an English family, so the model sees less variety of scenario than of language.
- **English-heavy, limited regional variety.** No Tamil, Kannada, Malayalam, Marathi or Gujarati. No romanised Telugu or Bengali. Code-mixing is covered only as romanised Hindi.
- **Text only.** Call scripts are written as text; nothing here represents audio, images or QR codes.
- **Fillers leak.** Scam rows only ever use the invented domains, UPI IDs and phone prefixes, and genuine rows only official domains, so a model can learn those strings instead of the wording. Link and UPI checks in the engine are a separate layer for that reason, and error analysis in Phase 4 will look for this.
- **Category balance is by design, not by prevalence.** The counts say nothing about how common each scam is in India.

## What it must not be used for

- Claims about how often scams happen, who is targeted, or which banks are affected.
- Training a system that decides on its own to block a payment or an account.
- Any use as a list of real scam numbers, IDs or sites: the indicators are invented.
- Writing scam messages. The scam rows are plain examples of well-known patterns, kept only to train and test a detector.
