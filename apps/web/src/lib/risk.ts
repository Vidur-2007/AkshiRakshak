import {
  Banknote,
  BadgeIndianRupee,
  BriefcaseBusiness,
  CircleAlert,
  CircleCheck,
  Gift,
  Headset,
  Heart,
  Landmark,
  Link2,
  MonitorSmartphone,
  OctagonX,
  Package,
  QrCode,
  ReceiptIndianRupee,
  ScanFace,
  Shield,
  ShieldAlert,
  Smartphone,
  TrendingUp,
  Undo2,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { ScamCategory, Severity, Verdict } from './engine';

export type RiskTone = 'scam' | 'warn' | 'safe';

/** Risk colour token per verdict. Use only where the colour means a risk level. */
export const VERDICT_COLOR: Record<Verdict, string> = {
  scam: 'var(--risk-scam)',
  suspicious: 'var(--risk-warn)',
  no_signs: 'var(--risk-safe)',
};

export const VERDICT_TONE: Record<Verdict, RiskTone> = {
  scam: 'scam',
  suspicious: 'warn',
  no_signs: 'safe',
};

export const TONE_COLOR: Record<RiskTone | 'ai', string> = {
  scam: 'var(--risk-scam)',
  warn: 'var(--risk-warn)',
  safe: 'var(--risk-safe)',
  ai: 'var(--ai)',
};

/** Risk is never shown by colour alone (§6): every verdict has an icon too. */
export const VERDICT_ICON: Record<Verdict, LucideIcon> = {
  scam: OctagonX,
  suspicious: CircleAlert,
  no_signs: CircleCheck,
};

export const SEVERITY_TONE: Record<Severity, RiskTone> = {
  critical: 'scam',
  high: 'scam',
  medium: 'warn',
  low: 'safe',
  none: 'safe',
};

/** Per-item risk (links, UPI IDs) uses the default verdict thresholds (SPEC.md §7.3). */
export function riskTone(score: number): RiskTone {
  if (score >= 70) return 'scam';
  if (score >= 40) return 'warn';
  return 'safe';
}

export const CATEGORY_ICON: Record<ScamCategory, LucideIcon> = {
  upi_collect: BadgeIndianRupee,
  qr_receive: QrCode,
  fake_kyc: ScanFace,
  bill_disconnection: Zap,
  digital_arrest: ShieldAlert,
  courier_customs: Package,
  job_task: BriefcaseBusiness,
  investment_crypto: TrendingUp,
  loan_app: Banknote,
  lottery_prize: Gift,
  fake_customer_care: Headset,
  refund_cashback: Undo2,
  wrong_transfer: ReceiptIndianRupee,
  malicious_apk: Smartphone,
  remote_access: MonitorSmartphone,
  otp_theft: ShieldAlert,
  romance: Heart,
  impersonation_govt: Landmark,
  phishing_link: Link2,
  other: Shield,
};

export function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}
