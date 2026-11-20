import { ChevronDown, MessageCircleQuestion, Search } from 'lucide-react';
import { lazy, Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, useLocation } from 'react-router';
import { cn } from '@/lib/utils';
import { linkBase } from './linkBase';
import { ElderToggle } from './ElderToggle';
import { LanguageSwitcher } from './LanguageSwitcher';
import { Logo } from './Logo';
import {
  DASHBOARD,
  isLearnPath,
  isModulesPath,
  LEARN,
  MODULES,
  NETWORK,
  SCAN,
  type NavItem,
} from './nav';
import { isMac, usePalette } from './paletteStore';
import { SosPill } from './SosButton';
import { ThemeToggle } from './ThemeToggle';

// Ask slide-over loads on first open (§5.13)
const AskSlideOver = lazy(() => import('@/components/learn/AskSlideOver'));

function TopLink({ item }: { item: NavItem }) {
  const { t } = useTranslation();
  return (
    <NavLink
      to={item.to}
      end={item.to === '/scan'}
      className={({ isActive }) =>
        cn(linkBase, isActive ? 'bg-overlay/8 text-text' : 'text-text/75 hover:text-text')
      }
    >
      {t(`nav.${item.key}`)}
    </NavLink>
  );
}

// Radix dropdown + floating-ui load after first paint (§7); until then the trigger
// renders as a plain button that looks the same.
const TopMenu = lazy(() => import('./TopMenu'));

function MenuFallback({ label, active }: { label: string; active: boolean }) {
  return (
    <button
      type="button"
      className={cn(linkBase, active ? 'bg-overlay/8 text-text' : 'text-text-2')}
      aria-haspopup="menu"
    >
      {label}
      <ChevronDown className="size-3.5 opacity-70" aria-hidden />
    </button>
  );
}

function LazyTopMenu(props: { label: string; items: NavItem[]; active: boolean }) {
  return (
    <Suspense fallback={<MenuFallback label={props.label} active={props.active} />}>
      <TopMenu {...props} />
    </Suspense>
  );
}

/**
 * Desktop top bar (≥ lg), laid out like the design's nav: links on the left, the serif wordmark in
 * the middle, tools and SOS on the right.
 */
export function TopBar() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const openPalette = usePalette((s) => s.setOpen);
  const [askOpen, setAskOpen] = useState(false);
  const [askLoaded, setAskLoaded] = useState(false);
  const iconBtn =
    'inline-flex size-10 elder:size-tap items-center justify-center rounded-full text-text/75 transition-colors hover:bg-overlay/6 hover:text-text outline-none focus-visible:outline-2 focus-visible:outline-brand';
  return (
    <header
      data-shell-header
      className="sticky top-0 z-40 hidden border-b border-glass-border bg-bg/85 backdrop-blur-xl lg:block"
    >
      <div className="mx-auto grid h-topbar max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-4 px-6">
        <nav aria-label={t('nav.main')} className="flex min-w-0 items-center gap-0.5">
          <TopLink item={SCAN} />
          <LazyTopMenu label={t('nav.modules')} items={MODULES} active={isModulesPath(pathname)} />
          <TopLink item={DASHBOARD} />
          <TopLink item={NETWORK} />
          <LazyTopMenu label={t('nav.learn')} items={LEARN} active={isLearnPath(pathname)} />
        </nav>
        <Logo />
        <div className="flex min-w-0 items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={() => openPalette(true)}
            aria-label={t('shell.openPalette')}
            title={isMac() ? '⌘K' : 'Ctrl K'}
            className={iconBtn}
          >
            <Search className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => {
              setAskLoaded(true);
              setAskOpen(true);
            }}
            aria-label={t('ask.openPanel')}
            className={iconBtn}
          >
            <MessageCircleQuestion className="size-4" aria-hidden />
          </button>
          <LanguageSwitcher />
          <ThemeToggle />
          <ElderToggle showLabel={false} className="px-1" />
          <SosPill />
        </div>
      </div>
      {askLoaded && (
        <Suspense fallback={null}>
          <AskSlideOver open={askOpen} onOpenChange={setAskOpen} />
        </Suspense>
      )}
    </header>
  );
}
