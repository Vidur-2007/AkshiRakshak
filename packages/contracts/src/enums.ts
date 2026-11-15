/**
 * Enum value lists for the contracts (SPEC.md §6). Plain arrays with no zod, so code that only
 * needs the values (the engine core in the browser) does not pull zod into its bundle.
 * schemas.ts builds the zod enums from these; @akshi/contracts re-exports both.
 */
export const LANGS = ['en', 'hi', 'te', 'bn'] as const;

export const VERDICTS = ['scam', 'suspicious', 'no_signs'] as const;

export const SEVERITIES = ['critical', 'high', 'medium', 'low', 'none'] as const;

export const INPUT_KINDS = [
  'message',
  'chat',
  'email',
  'url',
  'upi_id',
  'phone',
  'qr',
  'image',
  'collect_request',
] as const;

export const CHANNELS = [
  'sms',
  'whatsapp',
  'telegram',
  'email',
  'call',
  'other',
  'unknown',
] as const;

export const SCAM_CATEGORIES = [
  'upi_collect',
  'qr_receive',
  'fake_kyc',
  'bill_disconnection',
  'digital_arrest',
  'courier_customs',
  'job_task',
  'investment_crypto',
  'loan_app',
  'lottery_prize',
  'fake_customer_care',
  'refund_cashback',
  'wrong_transfer',
  'malicious_apk',
  'remote_access',
  'otp_theft',
  'romance',
  'impersonation_govt',
  'phishing_link',
  'other',
] as const;

export const SIGNAL_IDS = [
  // language and pressure
  'URGENCY',
  'THREAT_BLOCK',
  'THREAT_LEGAL',
  'AUTHORITY_CLAIM',
  'SECRECY',
  'STAY_ON_CALL',
  // credential and payment asks
  'ASKS_OTP',
  'ASKS_PIN',
  'ASKS_CVV_PASSWORD',
  'ASKS_REMOTE_APP',
  'APK_LINK',
  'RECEIVE_WITH_PIN',
  'COLLECT_REQUEST',
  'QR_TO_RECEIVE',
  'ADVANCE_FEE',
  // lures
  'PRIZE_LOTTERY',
  'TOO_GOOD_RETURNS',
  'TASK_JOB_PAYMENT',
  'WRONG_TRANSFER_RETURN',
  'CUSTOMER_CARE_NUMBER',
  // identity
  'BANK_IMPERSONATION',
  'BRAND_MISMATCH',
  'UPI_NAME_MISMATCH',
  'PERSONAL_UPI_HANDLE',
  'REPLY_TO_MISMATCH',
  // links and files
  'SUSPICIOUS_LINK',
  'LOOKALIKE_DOMAIN',
  'SHORTENED_URL',
  'IP_URL',
  'RISKY_TLD',
  'PUNYCODE',
  'NEW_DOMAIN',
  'REDIRECT_CHAIN',
  'RISKY_ATTACHMENT',
  'PREFILLED_AMOUNT',
  'OBFUSCATION',
  // context
  'ESCALATION',
  'KNOWN_INDICATOR',
  'BLOCKLISTED',
  // layers
  'MODEL_PATTERN',
  'AI_FLAG',
  // risk-reducing (negative weight)
  'SAFETY_ADVICE',
  'OFFICIAL_DOMAIN',
] as const;

export const ACTION_IDS = [
  'decline_request',
  'block_sender',
  'do_not_click',
  'do_not_pay',
  'do_not_share_otp',
  'do_not_install',
  'end_call',
  'verify_official',
  'report_chakshu',
  'report_1930',
  'report_cybercrime_portal',
  'call_bank',
  'warn_family',
  'emergency',
  'no_action_needed',
] as const;

export const SIGNAL_SOURCES = [
  'rule',
  'model',
  'url',
  'upi',
  'indicator',
  'ai',
  'context',
] as const;

export const BRAND_KINDS = [
  'bank',
  'govt',
  'payment_app',
  'courier',
  'utility',
  'telecom',
  'ecommerce',
  'other',
] as const;

export const LAYERS = ['rules', 'model', 'links', 'upi', 'indicators', 'ai'] as const;

export const STAGES = ['read', 'ocr', 'links', 'patterns', 'model', 'ai'] as const;

export const SPEND_CATEGORIES = [
  'food',
  'groceries',
  'shopping',
  'transport',
  'bills',
  'rent',
  'education',
  'health',
  'entertainment',
  'transfers',
  'salary',
  'cash',
  'investment',
  'emi',
  'other',
] as const;

export const TXN_CHANNELS = ['UPI', 'IMPS', 'NEFT', 'RTGS', 'CARD', 'ATM', 'OTHER'] as const;

export const ANOMALY_TYPES = [
  'large_new_payee',
  'burst_small_debits',
  'odd_hour',
  'duplicate',
  'credit_then_return',
  'round_amount_new_payee',
  'velocity',
  'isolation_outlier',
] as const;

export const EMERGENCY_QUESTION_IDS = [
  'sent_money',
  'entered_pin',
  'shared_otp',
  'installed_app',
  'gave_remote_access',
  'shared_card',
] as const;

export const EVAL_CONFIGS = ['rules_only', 'rules_model', 'full_no_ai', 'full_ai_sample'] as const;

export const API_ERROR_CODES = [
  'bad_request',
  'rate_limited',
  'upstream_unavailable',
  'timeout',
  'internal',
] as const;
