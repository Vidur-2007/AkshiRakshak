import { Moon, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/lib/store';
import { resolveTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';

/**
 * Day / night switch, drawn like the design's toggle: a track with a knob that slides. One tap
 * flips the theme you see now and keeps it (Settings can go back to following the phone).
 */
export function ThemeToggle({
  showLabel = false,
  className,
}: {
  showLabel?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const pref = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);
  const night = resolveTheme(pref) === 'night';
  const label = night ? t('theme.toDay') : t('theme.toNight');
  return (
    <button
      type="button"
      onClick={() => setTheme(night ? 'day' : 'night')}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex min-h-tap items-center gap-2.5 rounded-full px-1.5 text-sm text-text outline-none focus-visible:outline-2 focus-visible:outline-brand',
        className,
      )}
    >
      {showLabel && <span>{night ? t('theme.night') : t('theme.day')}</span>}
      <span
        aria-hidden
        className={cn(
          'relative block h-7 w-[3.25rem] shrink-0 rounded-full transition-colors duration-300',
          night ? 'bg-cyan/80' : 'bg-[#c8ced5]',
        )}
      >
        <span
          className={cn(
            'absolute top-1 left-1 grid size-5 place-items-center rounded-full bg-white shadow-[0_2px_6px_rgb(0_0_0/0.3)] transition-transform duration-300 ease-out',
            night && 'translate-x-6',
          )}
        >
          {night ? (
            <Moon className="size-3 text-[#04121a]" />
          ) : (
            <Sun className="size-3 text-[#10161d]" />
          )}
        </span>
      </span>
    </button>
  );
}
