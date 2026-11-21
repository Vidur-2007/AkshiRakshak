import { ArrowLeft, SearchX } from 'lucide-react';
import { m } from 'motion/react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useParams } from 'react-router';
import { ActionDock, WhatToDo } from '@/components/analysis/ActionDock';
import { CampaignMatchCard, useCampaignMatch } from '@/components/analysis/CampaignMatchCard';
import { ClaimVsRealityCard } from '@/components/analysis/ClaimVsRealityCard';
import { FeedbackBar } from '@/components/analysis/FeedbackBar';
import { EntityChips } from '@/components/analysis/EntityChips';
import { HighlightedText } from '@/components/analysis/HighlightedText';
import { LayerBreakdownBar } from '@/components/analysis/LayerBreakdownBar';
import { PrivacyFooter } from '@/components/analysis/PrivacyFooter';
import { ReasonList } from '@/components/analysis/ReasonList';
import { ResultSection } from '@/components/analysis/InlineResult';
import { ReadAloudButton } from '@/components/analysis/ReadAloudButton';
import { ScamReplay } from '@/components/analysis/ScamReplay';
import {
  REVEAL_MS,
  RevealProvider,
  useAfter,
  useReveal,
  useRevealTransition,
} from '@/components/analysis/reveal';
import { ScreenshotOverlay } from '@/components/analysis/ScreenshotOverlay';
import { PaidBeforeCard, usePaidBefore } from '@/components/statements/ScamLinks';
import { RepeatRequestsCard } from '@/components/analysis/RepeatRequests';
import { VerdictHeader } from '@/components/analysis/VerdictHeader';
import { ElderVerdict, firstSentence } from '@/components/elder/ElderViews';
import { ChatExtras } from '@/components/modules/ChatViews';
import { DomainAgeBadge, RedirectHops } from '@/components/modules/LinkExtras';
import { QRXray } from '@/components/modules/QRXray';
import { URLAnatomy } from '@/components/modules/URLAnatomy';
import type { AnalysisLocationState } from '@/components/scan/useScan';
import { PageFallback } from '@/components/shell/PageFallback';
import { buttonVariants } from '@/components/ui/button';
import { usePageTitle } from '@/hooks/usePageTitle';
import { categoryText, LANGS, type AnalysisResult, type Lang } from '@/lib/engine';
import { buildReplay } from '@/lib/replay';
import { loadImage, loadResult, peekResult } from '@/lib/scan';
import { useAppStore } from '@/lib/store';
import { VERDICT_COLOR } from '@/lib/risk';
import { cn } from '@/lib/utils';

type Load =
  { state: 'loading' } | { state: 'missing' } | { state: 'ready'; result: AnalysisResult };

function useResult(id: string): Load {
  // A fresh scan is already in memory: render it on the first frame so the card morph starts at once.
  const [load, setLoad] = useState<Load>(() => {
    const cached = peekResult(id);
    return cached ? { state: 'ready', result: cached } : { state: 'loading' };
  });
  useEffect(() => {
    let alive = true;
    const cached = peekResult(id);
    if (cached) {
      setLoad({ state: 'ready', result: cached });
      return;
    }
    setLoad({ state: 'loading' });
    void loadResult(id).then(
      (r) => alive && setLoad(r ? { state: 'ready', result: r } : { state: 'missing' }),
    );
    return () => {
      alive = false;
    };
  }, [id]);
  return load;
}

function Section({
  title,
  hint,
  className,
  delayMs,
  children,
}: {
  title: string;
  hint?: string;
  className?: string;
  delayMs: number;
  children: ReactNode;
}) {
  const tr = useRevealTransition();
  return (
    <m.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={tr(delayMs, 0.4)}
      className={cn('surface p-5 sm:p-6', className)}
    >
      <h2 className="text-sm font-medium tracking-wide text-text-2 uppercase">{title}</h2>
      {hint && <p className="mt-1 text-sm text-text-2">{hint}</p>}
      <div className="mt-4">{children}</div>
    </m.section>
  );
}

/** Screen readers hear the verdict once it is on screen (§5.3). */
function Announcer({ text }: { text: string }) {
  const [said, setSaid] = useState('');
  useEffect(() => {
    const id = window.setTimeout(() => setSaid(text), 100);
    return () => window.clearTimeout(id);
  }, [text]);
  return (
    <div className="sr-only" role="alert" aria-live="assertive" aria-atomic="true">
      {said}
    </div>
  );
}

/** The screenshot behind an image scan, if this device still has it. */
function useStoredImage(result: AnalysisResult): Blob | null {
  const [blob, setBlob] = useState<Blob | null>(null);
  useEffect(() => {
    if (result.kind !== 'image' || !result.image) return;
    let alive = true;
    void loadImage(result.id).then((b) => alive && setBlob(b));
    return () => {
      alive = false;
    };
  }, [result]);
  return blob;
}

function Analysis({ result, fresh }: { result: AnalysisResult; fresh: boolean }) {
  const { t } = useTranslation();
  const lang = useAppStore((s) => s.lang);
  const online = useAppStore((s) => s.online);
  const haptics = useAppStore((s) => s.haptics);
  const voiceAuto = useAppStore((s) => s.voiceAuto);
  const reveal = useReveal();
  const tr = useRevealTransition();
  const dockUp = useAfter(REVEAL_MS.dock);
  const verdictWord = t(`verdict.${result.verdict}`);
  const categoryName = result.category ? categoryText(result.category, lang).name : '';
  const textLang = (LANGS as readonly string[]).includes(result.detectedLang)
    ? (result.detectedLang as Lang)
    : undefined;
  const flagged = result.signals.some((s) => s.spans.length > 0);
  const image = useStoredImage(result);
  const urlFinding = result.kind === 'url' ? result.entities.urls[0] : undefined;
  const e = result.entities;
  const hasEntities = e.urls.length + e.upiIds.length + e.phones.length + e.amounts.length > 0;
  const hasExtras = !!image || !!result.qr || !!urlFinding || !!result.chat?.length;
  const replay = useMemo(() => buildReplay(result, lang), [result, lang]);
  const campaign = useCampaignMatch(result);
  const paidBefore = usePaidBefore(result);
  usePageTitle(`${verdictWord} · ${result.riskScore}/100`);

  // One short vibration on a scam verdict, when the dock rises (Android, haptics on)
  useEffect(() => {
    if (!dockUp || !fresh || !haptics || reveal.instant || result.verdict !== 'scam') return;
    try {
      navigator.vibrate?.(30);
    } catch {
      /* unsupported */
    }
  }, [dockUp, fresh, haptics, reveal.instant, result.verdict]);

  const glow = VERDICT_COLOR[result.verdict];

  return (
    <div className="relative" data-engine-version={result.engineVersion}>
      {/* Faint radial glow in the risk colour, arriving with the verdict (§5.3) */}
      <m.div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-24 h-[36rem]"
        style={{
          background: `radial-gradient(60% 55% at 50% 0%, color-mix(in srgb, ${glow} 16%, transparent), transparent 70%)`,
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={tr(REVEAL_MS.verdict, 0.8)}
      />
      <Announcer
        text={t('analysis.announce', {
          verdict: verdictWord,
          score: result.riskScore,
          category: categoryName,
        }).trim()}
      />

      <div className="relative mx-auto w-full max-w-6xl px-4 pt-6 pb-40 sm:px-6 lg:pt-10 lg:pb-8">
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <Link
            to="/scan"
            className={buttonVariants({ variant: 'ghost', size: 'sm', className: '-ml-2' })}
          >
            <ArrowLeft aria-hidden />
            {t('analysis.scanAnother')}
          </Link>
          <ReadAloudButton
            className="ml-auto"
            text={`${verdictWord}. ${result.explanation}`}
            lang={lang}
            {...(fresh && voiceAuto
              ? { autoPlayAfterMs: reveal.instant ? 300 : REVEAL_MS.dock }
              : {})}
          />
        </div>
        <h1 className="sr-only">{t('page.analysis.title')}</h1>

        {/* Desktop: two columns. Mobile: one stack in reading order (wrappers become `contents`). */}
        <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:items-start lg:gap-6">
          <div
            className={cn(
              'contents lg:flex lg:flex-col lg:gap-4',
              // a short left column stays in view; a tall one (screenshot, extras) scrolls
              !hasExtras && 'lg:sticky lg:top-[calc(var(--topbar-h)+24px)]',
            )}
          >
            <m.section
              layoutId="scan-card"
              className="order-2 rounded-sheet border border-glass-border bg-surface p-5 shadow-2xl shadow-black/30 sm:p-6 lg:order-none"
            >
              <h2 className="text-sm font-medium tracking-wide text-text-2 uppercase">
                {image ? t('overlay.title') : t('analysis.messageTitle')}
              </h2>
              {image && result.image ? (
                <div className="mt-3">
                  <ScreenshotOverlay result={result} image={image} />
                </div>
              ) : (
                <>
                  <p className="mt-1 text-sm text-text-2">
                    {flagged ? t('analysis.highlightsHint') : t('analysis.noHighlights')}
                  </p>
                  <div className="mt-4 max-h-[60vh] overflow-y-auto pr-1">
                    <HighlightedText text={result.text} signals={result.signals} lang={textLang} />
                  </div>
                </>
              )}
            </m.section>
            {(result.qr || urlFinding || result.chat?.length) && (
              <div className="order-2 flex flex-col gap-4 lg:order-none">
                {result.qr && (
                  <ResultSection title={t('xray.title')} delayMs={REVEAL_MS.reasons + 100}>
                    <QRXray payload={result.qr} />
                  </ResultSection>
                )}
                {urlFinding && (
                  <ResultSection title={t('anatomy.title')} delayMs={REVEAL_MS.reasons + 100}>
                    <div className="flex flex-col gap-4">
                      {urlFinding.domainAge && (
                        <div>
                          <DomainAgeBadge age={urlFinding.domainAge} />
                        </div>
                      )}
                      <URLAnatomy finding={urlFinding} />
                      {urlFinding.expanded && urlFinding.expanded.hops.length > 0 && (
                        <RedirectHops chain={urlFinding.expanded} />
                      )}
                    </div>
                  </ResultSection>
                )}
                <ChatExtras result={result} />
              </div>
            )}
            {hasEntities && (
              <Section
                title={t('analysis.entitiesTitle')}
                delayMs={REVEAL_MS.reasons + 200}
                className="order-5 lg:order-none"
              >
                <EntityChips entities={result.entities} />
              </Section>
            )}
          </div>

          <div className="contents lg:flex lg:flex-col lg:gap-4">
            <section data-tour="verdict" className="order-1 surface p-5 sm:p-6 lg:order-none">
              <VerdictHeader result={result} />
            </section>
            {paidBefore.length > 0 && (
              <div className="order-1 lg:order-none">
                <PaidBeforeCard payments={paidBefore} />
              </div>
            )}
            {/* only collect requests have a requester to count; skip the history read otherwise */}
            {result.kind === 'collect_request' && (
              <RepeatRequestsCard result={result} className="order-1 lg:order-none" />
            )}
            <Section
              title={t('analysis.reasonsTitle')}
              delayMs={REVEAL_MS.reasons}
              className="order-3 lg:order-none"
            >
              <ReasonList signals={result.signals} />
            </Section>
            {result.claimVsReality.length > 0 && (
              <Section
                title={t('analysis.claimsTitle')}
                delayMs={REVEAL_MS.reasons + 100}
                className="order-4 lg:order-none"
              >
                <ClaimVsRealityCard claims={result.claimVsReality} />
              </Section>
            )}
            {replay && (
              <Section
                title={t('replay.title')}
                delayMs={REVEAL_MS.reasons + 120}
                className="order-4 lg:order-none"
              >
                <ScamReplay replay={replay} />
              </Section>
            )}
            {campaign && (
              <Section title={t('campaign.title')} delayMs={0} className="order-4 lg:order-none">
                <CampaignMatchCard match={campaign} lang={lang} />
              </Section>
            )}
            <Section
              title={t('analysis.actionsTitle')}
              delayMs={REVEAL_MS.reasons + 150}
              className="order-6 lg:order-none"
            >
              <WhatToDo result={result} />
            </Section>
            <Section
              title={t('feedback.title')}
              delayMs={REVEAL_MS.reasons + 200}
              className="order-6 lg:order-none"
            >
              <FeedbackBar result={result} />
            </Section>
            <Section
              title={t('analysis.layersTitle')}
              delayMs={REVEAL_MS.reasons + 250}
              className="order-7 lg:order-none"
            >
              <LayerBreakdownBar layers={result.layers} online={online} aiUsed={result.aiUsed} />
            </Section>
            <div className="order-8 lg:order-none">
              <ActionDock result={result} />
            </div>
            <m.div
              className="order-9 px-1 lg:order-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={tr(REVEAL_MS.dock, 0.4)}
            >
              <PrivacyFooter result={result} />
            </m.div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AnalysisPage() {
  const { t } = useTranslation();
  const { id = '' } = useParams();
  const location = useLocation();
  const fresh = (location.state as AnalysisLocationState | null)?.fresh === true;
  const load = useResult(id);
  const elderMode = useAppStore((s) => s.elderMode);
  const [details, setDetails] = useState(false);

  if (load.state === 'loading') return <PageFallback />;
  if (load.state === 'missing') {
    return (
      <section className="mx-auto flex max-w-xl flex-col items-center px-4 pt-16 text-center">
        <SearchX className="size-10 text-text-2" aria-hidden />
        <h1 className="mt-4 text-xl font-semibold">{t('analysis.notFoundTitle')}</h1>
        <p className="mt-2 text-text-2">{t('analysis.notFoundBody')}</p>
        <Link to="/scan" className={buttonVariants({ size: 'lg', className: 'mt-6' })}>
          {t('analysis.newScan')}
        </Link>
      </section>
    );
  }
  // Elder Safety Mode: full-screen STOP / CAREFUL / No warning signs found (§5.10)
  if (elderMode && !details) {
    const r = load.result;
    return (
      <RevealProvider>
        <Announcer text={`${t(`elderVerdict.${r.verdict}`)}. ${firstSentence(r.explanation)}`} />
        <ElderVerdict result={r} fresh={fresh} onDetails={() => setDetails(true)} />
      </RevealProvider>
    );
  }
  return (
    <RevealProvider>
      <Analysis result={load.result} fresh={fresh} />
    </RevealProvider>
  );
}
