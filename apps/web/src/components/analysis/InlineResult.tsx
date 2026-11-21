import { ArrowRight } from 'lucide-react';
import { m } from 'motion/react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { buttonVariants } from '@/components/ui/button';
import type { AnalysisResult } from '@/lib/engine';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { ActionDock, WhatToDo } from './ActionDock';
import { ClaimVsRealityCard } from './ClaimVsRealityCard';
import { LayerBreakdownBar } from './LayerBreakdownBar';
import { PrivacyFooter } from './PrivacyFooter';
import { ReasonList } from './ReasonList';
import { REVEAL_MS, RevealProvider, useRevealTransition } from './reveal';
import { VerdictHeader } from './VerdictHeader';
import { FeedbackBar } from './FeedbackBar';

export function ResultSection({
  title,
  hint,
  delayMs = REVEAL_MS.reasons,
  className,
  tourId,
  children,
}: {
  title: string;
  hint?: string;
  delayMs?: number;
  className?: string;
  /** anchor for the judge tour's coach mark */
  tourId?: string;
  children: ReactNode;
}) {
  const tr = useRevealTransition();
  return (
    <m.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={tr(delayMs, 0.4)}
      data-tour={tourId}
      className={cn('surface p-5 sm:p-6', className)}
    >
      <h2 className="text-sm font-medium tracking-wide text-text-2 uppercase">{title}</h2>
      {hint && <p className="mt-1 text-sm text-text-2">{hint}</p>}
      <div className="mt-4">{children}</div>
    </m.section>
  );
}

function Body({
  result,
  before,
  after,
}: {
  result: AnalysisResult;
  before?: ReactNode;
  after?: ReactNode;
}) {
  const { t } = useTranslation();
  const online = useAppStore((s) => s.online);
  return (
    <div className="flex flex-col gap-4 pb-28 lg:pb-0" data-engine-version={result.engineVersion}>
      <section className="surface p-5 sm:p-6">
        <VerdictHeader result={result} />
      </section>
      {before}
      <ResultSection title={t('analysis.reasonsTitle')}>
        <ReasonList signals={result.signals} />
      </ResultSection>
      {result.claimVsReality.length > 0 && (
        <ResultSection title={t('analysis.claimsTitle')} delayMs={REVEAL_MS.reasons + 100}>
          <ClaimVsRealityCard claims={result.claimVsReality} />
        </ResultSection>
      )}
      {after}
      <ResultSection title={t('analysis.actionsTitle')} delayMs={REVEAL_MS.reasons + 150}>
        <WhatToDo result={result} />
      </ResultSection>
      <ResultSection title={t('feedback.title')} delayMs={REVEAL_MS.reasons + 200}>
        <FeedbackBar result={result} />
      </ResultSection>
      <ResultSection title={t('analysis.layersTitle')} delayMs={REVEAL_MS.reasons + 250}>
        <LayerBreakdownBar layers={result.layers} online={online} aiUsed={result.aiUsed} />
      </ResultSection>
      <ActionDock result={result} />
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <PrivacyFooter result={result} />
        <Link
          to={`/scan/${result.id}`}
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          {t('qrLink.openFull')}
          <ArrowRight aria-hidden />
        </Link>
      </div>
    </div>
  );
}

/**
 * A result shown inside a module page (§5.4 "Result uses the Analysis components
 * inline"). `before`/`after` slot module-specific cards around the reasons.
 */
export function InlineResult(props: {
  result: AnalysisResult;
  before?: ReactNode;
  after?: ReactNode;
}) {
  return (
    <RevealProvider>
      <Body key={props.result.id} {...props} />
    </RevealProvider>
  );
}
