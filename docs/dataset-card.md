# Dataset card — Akshi Rakshak messages (draft)

**Status: Phase 0 draft.** Sizes, splits, method details and known biases are filled in during Phase 1 (SPEC_C_DATA.md §3.6). This draft holds the scam taxonomy that guides template writing.

## Purpose

Train and evaluate a small text classifier that flags scam messages aimed at Indian UPI users, in English, Hindi (Devanagari and romanised Hinglish), Telugu and Bengali, and that does not flag the genuine bank, shop, courier and government messages people receive every day.

## Data safety rules

- All rows are synthetic (generated from templates written for this project) or handwritten by the team. No scraped or forwarded personal messages.
- Every phone number, UPI ID, link and name in a scam row is invented. Phone numbers use the placeholder prefixes `98765 0`, `98765 1` and `90000 0`. Scam domains come only from `data/fillers/scam_domains.yaml`; they are strings and are never opened, even if one happens to exist.
- No Aadhaar, PAN, card or account numbers, real or real-looking.
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

## Sizes, method, splits, known biases

To be completed in Phase 1.
