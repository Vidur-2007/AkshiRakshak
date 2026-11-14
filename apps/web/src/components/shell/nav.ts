import {
  ALargeSmall,
  BadgeCheck,
  GraduationCap,
  HandCoins,
  House,
  LayoutDashboard,
  MessageCircleQuestion,
  MessageSquareText,
  Play,
  QrCode,
  ReceiptText,
  ScanLine,
  Settings,
  Siren,
  Swords,
  Waypoints,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  to: string;
  /** i18n key under nav.* */
  key: string;
  icon: LucideIcon;
  /** i18n key under navDesc.*, for menus */
  descKey?: string;
}

export const MODULES: NavItem[] = [
  { to: '/modules/collect', key: 'collect', icon: HandCoins, descKey: 'collect' },
  { to: '/modules/messages', key: 'messages', icon: MessageSquareText, descKey: 'messages' },
  { to: '/modules/transactions', key: 'transactions', icon: ReceiptText, descKey: 'transactions' },
  { to: '/modules/qr-link', key: 'qrLink', icon: QrCode, descKey: 'qrLink' },
];

export const LEARN: NavItem[] = [
  { to: '/learn/dojo', key: 'dojo', icon: Swords, descKey: 'dojo' },
  { to: '/learn/ask', key: 'ask', icon: MessageCircleQuestion, descKey: 'ask' },
  { to: '/proof', key: 'proof', icon: BadgeCheck, descKey: 'proof' },
];

export const HOME: NavItem = { to: '/', key: 'home', icon: House };
export const SCAN: NavItem = { to: '/scan', key: 'scan', icon: ScanLine };
export const DASHBOARD: NavItem = { to: '/dashboard', key: 'dashboard', icon: LayoutDashboard };
export const NETWORK: NavItem = { to: '/network', key: 'network', icon: Waypoints };
export const LEARN_TAB: NavItem = { to: '/learn/dojo', key: 'learn', icon: GraduationCap };
export const SETTINGS: NavItem = { to: '/settings', key: 'settings', icon: Settings };
export const SOS: NavItem = { to: '/sos', key: 'sos', icon: Siren };
export const TOUR: NavItem = { to: '/tour', key: 'tour', icon: Play };

/** Every destination the command palette can jump to. */
export const ALL_DESTINATIONS: NavItem[] = [
  HOME,
  SCAN,
  ...MODULES,
  DASHBOARD,
  NETWORK,
  ...LEARN,
  SOS,
  SETTINGS,
  TOUR,
];

export const ElderIcon = ALargeSmall;

/** Learn tab stays highlighted on any learn page and on /proof. */
export function isLearnPath(pathname: string): boolean {
  return pathname.startsWith('/learn') || pathname === '/proof';
}

export function isModulesPath(pathname: string): boolean {
  return pathname.startsWith('/modules');
}
