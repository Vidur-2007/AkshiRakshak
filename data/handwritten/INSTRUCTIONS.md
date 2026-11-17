# Handwritten test set — instructions for the team

We need about **150 messages written by us** (about 50 per person). They are the honest test of the app: the model never sees them while it is trained or tuned, so they show how it does on messages that were not generated from our own templates.

## What to write

- **About half scams, half genuine.** Genuine means messages a real bank, shop, courier or government service would send: OTPs with "do not share", debit alerts, UPI confirmations, delivery updates, bill reminders, offers.
- **Languages you read well:** English, Hindi (Devanagari or romanised Hinglish), Telugu, Bengali. Write them the way people actually type: short forms, mixed English words, small mistakes are fine.
- **Spread over scam types:** KYC/account blocked, UPI collect "refund", QR to "receive" money, electricity disconnection, digital arrest / fake police, courier or customs fee, part-time task jobs, investment or crypto tips, loan apps, lottery or prize, fake customer care, refund or cashback, "sent by mistake, please return", APK files (wedding card, bank update), screen-sharing apps, OTP requests, romance, fake government schemes, phishing links. Do not try to cover them all; write what you have actually seen or heard about.
- **Realistic, not textbook.** Vary length and tone: a one-line SMS, a long WhatsApp forward, a polite email, a rude follow-up.

## Safety rules (important)

- **Invent every number and ID.** Phone numbers like `98765 0xxxx` or `90000 0xxxx`, UPI IDs like `refund.help2026@ybl`, made-up links like `sbi-kyc-check.xyz`. Never paste a real phone number, UPI ID, account number, card number, PAN or Aadhaar.
- **No real private people.** Use common first names only. Do not copy messages from your own phone or anyone else's; rewrite them in your own words with invented details.
- **Never open the invented links.** They are just text.
- For genuine messages, official domains (sbi.co.in, hdfcbank.com, indiapost.gov.in, …) are fine.

## How to send them

1. Copy `TEMPLATE.csv`, **delete its three example rows** (author `Example`), and fill one row per message. Columns:
   - `text` — the message (put it in double quotes; inside the text, write a double quote as `""`)
   - `lang` — `en`, `hi`, `te` or `bn` (romanised Hindi is `hi`)
   - `channel` — `sms`, `whatsapp`, `telegram`, `email`, `call` or `other`
   - `label` — `scam` or `legit`
   - `category` — for scams, one of: upi_collect, qr_receive, fake_kyc, bill_disconnection, digital_arrest, courier_customs, job_task, investment_crypto, loan_app, lottery_prize, fake_customer_care, refund_cashback, wrong_transfer, malicious_apk, remote_access, otp_theft, romance, impersonation_govt, phishing_link (use `other` if none fits). Leave it **empty** for genuine messages.
   - `author` — your first name (so we can count per person; it is not shown anywhere)
2. Save as `handwritten-<yourname>.csv` (UTF-8) and send it to Laptop C's human by **end of Day 2**.
3. Laptop C's human puts the files in this folder. **Do not show them to Claude Code before Phase 4**, and do not share them with the other laptops' Claude sessions.

They are converted to `data/messages/handwritten.jsonl` with split `handwritten` and used only for the final measurement.
