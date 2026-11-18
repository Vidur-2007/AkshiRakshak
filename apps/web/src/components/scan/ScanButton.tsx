import { ScanLine } from 'lucide-react';
import { m } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { ringOffset } from '@/lib/gauge';
import { spring } from '@/lib/motion';
import { cn } from '@/lib/utils';

const R = 11;

/** Scan button; a ring fills while analyze runs (§5.2). */
export function ScanButton({
  busy,
  progress,
  disabled,
  className,
}: {
  busy: boolean;
  /** 0–1 */
  progress: number;
  disabled?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const { circumference, offset } = ringOffset(R, progress);
  return (
    <m.button
      type="submit"
      disabled={disabled || busy}
      aria-busy={busy}
      whileTap={{ scale: 0.97 }}
      transition={spring.ui}
      className={cn(
        'relative inline-flex min-h-12 items-center justify-center gap-2.5 rounded-full bg-brand px-7 text-base font-semibold text-brand-contrast transition-[background-color,opacity] duration-150 hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-50 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
        busy && 'disabled:opacity-100',
        className,
      )}
    >
      <span className="relative grid size-6 place-items-center" aria-hidden>
        {busy ? (
          <svg viewBox="0 0 28 28" className="size-6 -rotate-90">
            <circle
              cx="14"
              cy="14"
              r={R}
              fill="none"
              stroke="currentColor"
              strokeOpacity="0.25"
              strokeWidth="3"
            />
            <m.circle
              cx="14"
              cy="14"
              r={R}
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: offset }}
              transition={spring.ui}
            />
          </svg>
        ) : (
          <ScanLine className="size-5" />
        )}
      </span>
      {busy ? t('scan.scanning') : t('scan.scan')}
    </m.button>
  );
}
