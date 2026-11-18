import { Sparkles } from 'lucide-react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Switch } from '@/components/ui/switch';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';

/** AI second opinion (M1.11): off by default, masked text only, disabled offline. */
export function AiToggle() {
  const { t } = useTranslation();
  const id = useId();
  const noteId = useId();
  const aiOptIn = useAppStore((s) => s.aiOptIn);
  const setAiOptIn = useAppStore((s) => s.setAiOptIn);
  const online = useAppStore((s) => s.online);
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-card border border-glass-border bg-surface p-4',
        !online && 'opacity-80',
      )}
    >
      <Sparkles className="mt-0.5 size-5 shrink-0 text-ai" aria-hidden />
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className="font-medium text-text">
          {t('scan.aiTitle')}
        </label>
        <p id={noteId} className="mt-1 text-sm text-text-2">
          {online ? t('scan.aiNote') : t('scan.aiOffline')}
        </p>
      </div>
      <Switch
        id={id}
        checked={aiOptIn && online}
        disabled={!online}
        onCheckedChange={setAiOptIn}
        aria-describedby={noteId}
        className="mt-0.5 data-[state=checked]:border-ai/60 data-[state=checked]:bg-ai/25 [&>span]:data-[state=checked]:bg-ai"
      />
    </div>
  );
}
