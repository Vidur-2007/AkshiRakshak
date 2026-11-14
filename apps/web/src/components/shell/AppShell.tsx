import { AnimatePresence, LazyMotion, m, MotionConfig } from 'motion/react';
import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollRestoration, useLocation, useOutlet } from 'react-router';
import { loadMotionFeatures, pageVariants } from '@/lib/motion';
import { BottomTabBar } from './BottomTabBar';
import { CommandPaletteHost } from './CommandPaletteHost';
import { MobileHeader } from './MobileHeader';
import { OfflinePill } from './OfflinePill';
import { PageFallback } from './PageFallback';
import { TopBar } from './TopBar';
import { useShellEffects } from './useShellEffects';

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
  useShellEffects();

  return (
    <LazyMotion features={loadMotionFeatures} strict>
      <MotionConfig reducedMotion="user">
        <a
          href="#main"
          className="sr-only-focusable fixed top-2 left-2 z-[60] rounded-chip bg-brand px-4 py-2 font-medium text-brand-contrast"
        >
          {t('app.skipToContent')}
        </a>
        <TopBar />
        <MobileHeader />
        <OfflinePill />
        <main
          id="main"
          tabIndex={-1}
          className="relative min-h-[calc(100dvh-var(--topbar-h))] pb-[calc(var(--tabbar-h)+env(safe-area-inset-bottom)+24px)] outline-none lg:pb-12"
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
        <BottomTabBar />
        <CommandPaletteHost />
        <Suspense fallback={null}>
          <Toaster />
        </Suspense>
        <ScrollRestoration />
      </MotionConfig>
    </LazyMotion>
  );
}
