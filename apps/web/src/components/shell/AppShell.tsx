import { AnimatePresence, LazyMotion, m, MotionConfig } from 'motion/react';
import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollRestoration, useLocation, useOutlet } from 'react-router';
import { loadMotionFeatures, pageVariants } from '@/lib/motion';
import { useAppStore } from '@/lib/store';
import { useTour } from '@/lib/tour';
import { cn } from '@/lib/utils';
import { BottomTabBar } from './BottomTabBar';
import { CommandPaletteHost } from './CommandPaletteHost';
import { MobileHeader } from './MobileHeader';
import { OfflinePill } from './OfflinePill';
import { PageFallback } from './PageFallback';
import { TopBar } from './TopBar';
import { useShellEffects } from './useShellEffects';

// The judge tour's overlay loads only while a tour runs (§5.17)
const TourOverlay = lazy(() => import('@/components/tour/TourOverlay'));

// sonner loads in its own chunk right after first paint
const Toaster = lazy(() =>
  import('@/components/ui/sonner').then((mod) => ({ default: mod.Toaster })),
);

function isFreshScan(state: unknown): boolean {
  return (
    typeof state === 'object' && state !== null && (state as { fresh?: unknown }).fresh === true
  );
}

/** The frame around every route (SPEC_B_WEB.md §4). */
export function AppShell() {
  const { t } = useTranslation();
  const location = useLocation();
  const outlet = useOutlet();
  const touring = useTour((s) => s.active);
  const online = useAppStore((s) => s.online);
  useShellEffects();
  // Emergency help is a calm full-screen takeover (§5.9): no navigation chrome.
  const takeover = location.pathname === '/sos' || location.pathname.startsWith('/sos/');

  return (
    <LazyMotion features={loadMotionFeatures} strict>
      <MotionConfig reducedMotion="user">
        <a
          href="#main"
          className="sr-only-focusable fixed top-2 left-2 z-[60] rounded-chip bg-brand px-4 py-2 font-medium text-brand-contrast"
        >
          {t('app.skipToContent')}
        </a>
        {!takeover && <TopBar />}
        {!takeover && <MobileHeader />}
        <OfflinePill />
        <main
          id="main"
          tabIndex={-1}
          className={cn(
            takeover
              ? 'relative min-h-dvh outline-none'
              : 'relative min-h-[calc(100dvh-var(--topbar-h))] pb-[calc(var(--tabbar-h)+env(safe-area-inset-bottom)+24px)] outline-none lg:pb-12',
            // room for the "Offline" pill, so it never covers a page title
            !online && 'pt-12',
          )}
        >
          {/* Route change: outgoing fades and moves up 8px, incoming fades in (§4.1).
              Straight after a scan the incoming page skips its fade, so the shared
              "scan-card" morph carries the transition instead. */}
          <AnimatePresence mode="wait" initial={false}>
            <m.div
              key={location.pathname}
              variants={pageVariants}
              initial={isFreshScan(location.state) ? false : 'initial'}
              animate="animate"
              exit="exit"
            >
              <Suspense fallback={<PageFallback />}>{outlet}</Suspense>
            </m.div>
          </AnimatePresence>
        </main>
        {!takeover && <BottomTabBar />}
        <CommandPaletteHost />
        <Suspense fallback={null}>
          <Toaster />
        </Suspense>
        {touring && (
          <Suspense fallback={null}>
            <TourOverlay />
          </Suspense>
        )}
        <ScrollRestoration />
      </MotionConfig>
    </LazyMotion>
  );
}
