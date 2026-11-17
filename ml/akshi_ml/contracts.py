"""Enums mirrored from packages/contracts (SPEC.md §6.1). tests/test_contracts.py checks they match the TS source."""
LANGS = ("en", "hi", "te", "bn")
CHANNELS = ("sms", "whatsapp", "telegram", "email", "call", "other", "unknown")
SCAM_CATEGORIES = (
    "upi_collect", "qr_receive", "fake_kyc", "bill_disconnection", "digital_arrest",
    "courier_customs", "job_task", "investment_crypto", "loan_app", "lottery_prize",
    "fake_customer_care", "refund_cashback", "wrong_transfer", "malicious_apk",
    "remote_access", "otp_theft", "romance", "impersonation_govt", "phishing_link", "other",
)
# The 19 categories the dataset must cover (everything except "other"), SPEC_C_DATA.md §3.2
DATASET_CATEGORIES = tuple(c for c in SCAM_CATEGORIES if c != "other")

# Dataset-only enums (SPEC_C_DATA.md §3.1)
SCRIPTS = ("latn", "deva", "telu", "beng", "mixed")
LABELS = ("scam", "legit")
SPLITS = ("train", "val", "test", "handwritten")
SOURCES = ("synthetic", "handwritten")
