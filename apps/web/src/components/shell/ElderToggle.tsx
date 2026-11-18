import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Switch } from '@/components/ui/switch';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { ElderIcon } from './nav';

export function ElderToggle({
  className,
  showLabel = true,
  showHint = false,
}: {
  className?: string;
  showLabel?: boolean;
  showHint?: boolean;
}) {
  const { t } = useTranslation();
  const id = useId();
  const elderMode = useAppStore((s) => s.elderMode);
  const setElderMode = useAppStore((s) => s.setElderMode);
  return (
    <div className={cn('flex min-h-tap items-center gap-2.5', className)}>
      <label htmlFor={id} className="flex cursor-pointer items-center gap-2 text-sm text-text">
        <ElderIcon className="size-4.5 text-text-2" aria-hidden />
        <span className={cn(!showLabel && 'sr-only')}>
          {t('shell.elderMode')}
          {showHint && (
            <span className="block text-xs text-text-2">{t('shell.elderModeHint')}</span>
          )}
        </span>
      </label>
      <Switch id={id} checked={elderMode} onCheckedChange={setElderMode} />
    </div>
  );
}
