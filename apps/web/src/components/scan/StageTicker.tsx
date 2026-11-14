import { Check, Circle, CircleSlash, LoaderCircle, X } from 'lucide-react';
import { m } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { stageText } from '@/lib/engine';
import { fadeUp, stagger } from '@/lib/motion';
import type { TickerStage, TickerState, TickerStatus } from '@/lib/scanTiming';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';

function StatusIcon({ status }: { status: TickerStatus }) {
  switch (status) {
    case 'done':
      return <Check className="size-4 text-brand" aria-hidden />;
    case 'running':
      return <LoaderCircle className="size-4 animate-spin text-text" aria-hidden />;
    case 'skipped':
      return <CircleSlash className="size-4 text-text-2/70" aria-hidden />;
    case 'failed':
      return <X className="size-4 text-text-2" aria-hidden />;
    default:
      return <Circle className="size-4 text-text-2/40" aria-hidden />;
  }
}

/**
 * Lists the stages reported by onStage; each ticks when done (§5.2). Skipped stages
 * (no model yet, AI off) say so instead of pretending to run.
 */
export function StageTicker({ state, stages }: { state: TickerState; stages: TickerStage[] }) {
  const { t } = useTranslation();
  const lang = useAppStore((s) => s.lang);
  return (
    <m.ol
      variants={stagger(0.04)}
      initial="hidden"
      animate="show"
      aria-label={t('scan.stagesLabel')}
      className="flex flex-wrap gap-x-5 gap-y-2"
    >
      {stages.map((stage) => {
        const status = state[stage];
        return (
          <m.li
            key={stage}
            variants={fadeUp}
            className={cn(
              'inline-flex items-center gap-2 text-sm',
              status === 'done' || status === 'running' ? 'text-text' : 'text-text-2',
              status === 'skipped' && 'line-through decoration-text-2/40',
            )}
          >
            <StatusIcon status={status} />
            <span>{stageText(stage, lang)}</span>
            <span className="sr-only">: {t(`stageStatus.${status}`)}</span>
          </m.li>
        );
      })}
    </m.ol>
  );
}
