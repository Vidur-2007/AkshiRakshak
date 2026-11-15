import { ChevronDown, MessageCircleQuestion, Search } from 'lucide-react';
import { lazy, Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink, useLocation } from 'react-router';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
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

// Ask slide-over loads on first open (§5.13)
const AskSlideOver = lazy(() => import('@/components/learn/AskSlideOver'));

const linkBase =
  'inline-flex min-h-10 items-center gap-1.5 rounded-chip px-3 text-sm font-medium transition-colors duration-150 outline-none focus-visible:outline-2 focus-visible:outline-brand';

function TopLink({ item }: { item: NavItem }) {
  const { t } = useTranslation();
  return (
    <NavLink
      to={item.to}
      end={item.to === '/scan'}
      className={({ isActive }) =>
        cn(linkBase, isActive ? 'bg-white/8 text-text' : 'text-text-2 hover:text-text')
      }
    >
      {t(`nav.${item.key}`)}
    </NavLink>
  );
}

function TopMenu({ label, items, active }: { label: string; items: NavItem[]; active: boolean }) {
  const { t } = useTranslation();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          linkBase,
          'data-[state=open]:bg-white/8 data-[state=open]:text-text',
          active ? 'bg-white/8 text-text' : 'text-text-2 hover:text-text',
        )}
      >
        {label}
        <ChevronDown className="size-3.5 opacity-70" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-80">
        {items.map((item) => (
          <DropdownMenuItem key={item.to} asChild>
            <Link to={item.to}>
              <item.icon aria-hidden />
              <span className="flex flex-col">
                <span className="font-medium text-text">{t(`nav.${item.key}`)}</span>
                {item.descKey && (
                  <span className="text-xs text-text-2">{t(`navDesc.${item.descKey}`)}</span>
                )}
              </span>
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Desktop glass top bar (≥ lg). */
export function TopBar() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const openPalette = usePalette((s) => s.setOpen);
  const [askOpen, setAskOpen] = useState(false);
  const [askLoaded, setAskLoaded] = useState(false);
  return (
    <header className="glass sticky top-0 z-40 hidden border-x-0 border-t-0 lg:block">
      <div className="mx-auto flex h-topbar max-w-7xl items-center gap-3 px-6">
        <Logo />
        <nav aria-label={t('nav.main')} className="ml-2 flex items-center gap-0.5">
          <TopLink item={SCAN} />
          <TopMenu label={t('nav.modules')} items={MODULES} active={isModulesPath(pathname)} />
          <TopLink item={DASHBOARD} />
          <TopLink item={NETWORK} />
          <TopMenu label={t('nav.learn')} items={LEARN} active={isLearnPath(pathname)} />
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => openPalette(true)}
            aria-label={t('shell.openPalette')}
            className="inline-flex min-h-10 items-center gap-2 rounded-chip border border-glass-border px-3 text-sm text-text-2 transition-colors hover:text-text outline-none focus-visible:outline-2 focus-visible:outline-brand"
          >
            <Search className="size-4" aria-hidden />
            <kbd className="hidden font-mono text-xs xl:inline">{isMac() ? '⌘K' : 'Ctrl K'}</kbd>
          </button>
          <button
            type="button"
            onClick={() => {
              setAskLoaded(true);
              setAskOpen(true);
            }}
            aria-label={t('ask.openPanel')}
            className="inline-flex size-10 items-center justify-center rounded-chip border border-glass-border text-text-2 transition-colors hover:text-text outline-none focus-visible:outline-2 focus-visible:outline-brand"
          >
            <MessageCircleQuestion className="size-4" aria-hidden />
          </button>
          <LanguageSwitcher />
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
