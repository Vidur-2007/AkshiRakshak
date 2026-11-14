import { Ellipsis } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, useLocation } from 'react-router';
import { cn } from '@/lib/utils';
import { MoreSheet } from './MoreSheet';
import { DASHBOARD, HOME, isLearnPath, LEARN_TAB, SCAN, type NavItem } from './nav';

const tabBase =
  'flex min-h-tap flex-1 flex-col items-center justify-center gap-0.5 rounded-chip text-[0.7rem] font-medium leading-tight transition-colors duration-150 outline-none focus-visible:outline-2 focus-visible:outline-brand';

function Tab({ item, active }: { item: NavItem; active?: boolean }) {
  const { t } = useTranslation();
  return (
    <NavLink
      to={item.to}
      end
      className={({ isActive }) =>
        cn(tabBase, (active ?? isActive) ? 'text-brand' : 'text-text-2 hover:text-text')
      }
    >
      <item.icon className="size-5" aria-hidden />
      <span className="max-w-full truncate">{t(`nav.${item.key}`)}</span>
    </NavLink>
  );
}

/** Mobile bottom tab bar (< lg): Home, Scan (raised), Dashboard, Learn, More. */
export function BottomTabBar() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const scanActive = pathname === '/scan' || pathname.startsWith('/scan/');
  return (
    <>
      <nav
        aria-label={t('nav.main')}
        className="glass fixed inset-x-0 bottom-0 z-40 border-x-0 border-b-0 pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        <div className="mx-auto flex h-tabbar max-w-xl items-stretch gap-1 px-2 py-1.5">
          <Tab item={HOME} />
          <Tab item={DASHBOARD} />
          <div className="flex flex-1 justify-center">
            <NavLink
              to={SCAN.to}
              aria-label={t('nav.scan')}
              className={cn(
                '-mt-6 flex size-16 flex-col items-center justify-center gap-0.5 rounded-full border-4 border-bg bg-brand text-brand-contrast shadow-glow-brand transition-transform duration-150 active:scale-95 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
                scanActive && 'ring-2 ring-brand/50',
              )}
            >
              <SCAN.icon className="size-6" aria-hidden />
              <span className="text-[0.65rem] font-semibold leading-none">{t('nav.scan')}</span>
            </NavLink>
          </div>
          <Tab item={LEARN_TAB} active={isLearnPath(pathname)} />
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            className={cn(tabBase, moreOpen ? 'text-brand' : 'text-text-2 hover:text-text')}
          >
            <Ellipsis className="size-5" aria-hidden />
            <span>{t('nav.more')}</span>
          </button>
        </div>
      </nav>
      <MoreSheet open={moreOpen} onOpenChange={setMoreOpen} />
    </>
  );
}
