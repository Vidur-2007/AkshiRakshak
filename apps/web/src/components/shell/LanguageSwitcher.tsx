import { useTranslation } from 'react-i18next';
import type { Lang } from '@/lib/engine';
import { UI_LANGS as LANGS } from '@/lib/langs';
import { LANG_SHORT } from '@/lib/i18n';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';

/** EN / हि / తె / বা segmented control. */
export function LanguageSwitcher({
  className,
  full = false,
}: {
  className?: string;
  /** show full language names (used in the mobile sheet and Settings) */
  full?: boolean;
}) {
  const { t } = useTranslation();
  const lang = useAppStore((s) => s.lang);
  const setLang = useAppStore((s) => s.setLang);
  return (
    <div
      role="radiogroup"
      aria-label={t('shell.language')}
      className={cn(
        'inline-flex items-center gap-0.5 rounded-chip border border-glass-border bg-surface/60 p-0.5',
        className,
      )}
    >
      {LANGS.map((l: Lang) => {
        const active = l === lang;
        return (
          <button
            key={l}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={t(`lang.${l}`)}
            lang={l}
            onClick={() => setLang(l)}
            className={cn(
              'min-h-9 rounded-[10px] px-2.5 text-sm font-medium transition-colors duration-150 outline-none focus-visible:outline-2 focus-visible:outline-brand',
              full && 'min-h-tap flex-1 px-3',
              active ? 'bg-brand/15 text-brand' : 'text-text-2 hover:bg-white/6 hover:text-text',
            )}
          >
            {full ? t(`lang.${l}`) : LANG_SHORT[l]}
          </button>
        );
      })}
    </div>
  );
}
