import { WifiOff } from 'lucide-react';
import { AnimatePresence, m } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { transition } from '@/lib/motion';
import { useAppStore } from '@/lib/store';

/** "Offline — checks still work" when navigator.onLine is false (§4). */
export function OfflinePill() {
  const { t } = useTranslation();
  const online = useAppStore((s) => s.online);
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-[calc(var(--topbar-h)+8px)] z-30 flex justify-center px-4"
    >
      <AnimatePresence>
        {!online && (
          <m.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={transition.base}
            className="glass pointer-events-auto inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm text-text"
          >
            <WifiOff className="size-4 text-text-2" aria-hidden />
            {t('shell.offline')}
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
