import { ExternalLink, FlaskConical, Lightbulb, Search } from 'lucide-react';
import { Tabs } from 'radix-ui';
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { RevealProvider } from '@/components/analysis/reveal';
import {
  BarList,
  categoryRows,
  DayArea,
  KpiTile,
  NetworkPreview,
  RecentDetectionsFeed,
  SampleDataBadge,
} from '@/components/dashboard/DashboardViews';
import { buttonVariants } from '@/components/ui/button';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useSampleHistory } from '@/hooks/useSampleHistory';
import { subscribe } from '@/lib/broadcast';
import { byCategory, byDay, computeKpis, personalTips } from '@/lib/dashboard';
import { allScans, toScanRecord, type ScanRecord } from '@/lib/db';
import {
  categoryText,
  LANDSCAPE,
  lookupIndicator,
  PATTERN_CARDS,
  type IndicatorMatch,
} from '@/lib/engine';
import { l10n } from '@/lib/l10n';
import { isSampleCheck } from '@/lib/sampleHistory';
import { loadResult } from '@/lib/scan';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';

function Card({
  title,
  extra,
  children,
  className,
}: {
  title: string;
  extra?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('surface p-5 sm:p-6', className)}>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-medium tracking-wide text-text-2 uppercase">{title}</h2>
        {extra}
      </div>
      {children}
    </section>
  );
}

/** History, kept live: another tab's scan broadcast prepends the new record (M8.2). */
export function useLiveHistory(): ScanRecord[] | null {
  const [scans, setScans] = useState<ScanRecord[] | null>(null);
  const reload = useCallback(() => void allScans().then(setScans), []);
  useEffect(() => {
    reload();
    return subscribe((msg) => {
      if (msg.type === 'cleared') setScans([]);
      if (msg.type !== 'scan') return;
      void loadResult(msg.id)
        .then((r) => {
          const rec = r ? toScanRecord(r) : null;
          if (rec) setScans((prev) => [rec, ...(prev ?? []).filter((s) => s.id !== rec.id)]);
        })
        .catch(() => undefined);
    });
  }, [reload]);
  return scans;
}

/** Personal tips (M11.6): patterns from the user's own flagged checks. */
function Tips({ scans }: { scans: ScanRecord[] }) {
  const { t } = useTranslation();
  const hasContact = useAppStore((s) => !!s.trustedContact);
  const tips = personalTips(scans, hasContact);
  return (
    <ul className="flex flex-col gap-3">
      {tips.map((tip) => (
        <li key={tip.id} className="flex gap-3">
          <Lightbulb className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
          <div className="min-w-0">
            <p className="font-medium">{t(`tips.${tip.id}.title`)}</p>
            <p className="mt-0.5 text-sm text-text-2">{t(`tips.${tip.id}.body`)}</p>
            {tip.count > 0 && (
              <p className="mt-1 text-xs text-text-2">{t('tips.seen', { count: tip.count })}</p>
            )}
            {tip.id === 'contact' && (
              <Link
                to="/settings"
                className="mt-1 inline-block text-sm text-brand underline-offset-4 hover:underline"
              >
                {t('tips.contactLink')}
              </Link>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function SampleBanner({
  show,
  hasOwn,
  onChange,
}: {
  show: boolean;
  hasOwn: boolean;
  onChange(on: boolean): void;
}) {
  const { t } = useTranslation();
  if (!show)
    return (
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          <FlaskConical aria-hidden />
          {t('dash.sampleShow')}
        </button>
      </div>
    );
  return (
    <div
      role="status"
      className="flex flex-col gap-3 rounded-card border border-brand/40 bg-brand/8 p-4 sm:flex-row sm:items-center"
    >
      <FlaskConical className="size-5 shrink-0 text-brand" aria-hidden />
      <p className="flex-1 text-sm">
        <span className="font-semibold">{t('dash.sampleTitle')}</span>{' '}
        <span className="text-text-2">
          {hasOwn ? t('dash.sampleBodyMixed') : t('dash.sampleBody')}
        </span>
      </p>
      <button
        type="button"
        onClick={() => onChange(false)}
        className={buttonVariants({ variant: 'outline', size: 'sm', className: 'shrink-0' })}
      >
        {t('dash.sampleHide')}
      </button>
    </div>
  );
}

function Shield() {
  const { t } = useTranslation();
  const lang = useAppStore((s) => s.lang);
  const scans = useLiveHistory();
  const sample = useSampleHistory(scans);
  // own checks and samples in time order; the network preview uses own checks only
  const list = useMemo(
    () =>
      [...(scans ?? []), ...sample.samples].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [scans, sample.samples],
  );
  const own = scans ?? [];
  const k = computeKpis(list);
  return (
    <RevealProvider>
      <div className="flex flex-col gap-4">
        {scans && (
          <SampleBanner show={sample.show} hasOwn={own.length > 0} onChange={sample.setShow} />
        )}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiTile label={t('dash.kScans')} value={k.scans} />
          <KpiTile label={t('dash.kThreats')} value={k.threats} delayMs={80} />
          <KpiTile label={t('dash.kMoney')} value={k.moneyAtRisk} money delayMs={160} />
          <KpiTile label={t('dash.kLinks')} value={k.linksAndQrs} delayMs={240} />
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <Card title={t('dash.recentTitle')}>
            {scans && <RecentDetectionsFeed scans={list} isSample={isSampleCheck} />}
          </Card>
          <div className="flex flex-col gap-4">
            {scans && (
              <Card title={t('tips.title')}>
                <Tips scans={list} />
              </Card>
            )}
            <Card title={t('dash.byCategoryTitle')}>
              <BarList
                rows={categoryRows(byCategory(list), lang)}
                emptyText={t('dash.noCategories')}
              />
            </Card>
            <Card title={t('dash.byDayTitle')}>
              <DayArea days={byDay(list)} />
            </Card>
            <Card title={t('dash.networkTitle')} extra={<SampleDataBadge />}>
              <NetworkPreview scans={own} />
            </Card>
          </div>
        </div>
      </div>
    </RevealProvider>
  );
}

function Lookup() {
  const { t } = useTranslation();
  const lang = useAppStore((s) => s.lang);
  const id = useId();
  const [value, setValue] = useState('');
  const [result, setResult] = useState<IndicatorMatch | null | undefined>(undefined);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const v = value.trim();
    if (v) setResult(lookupIndicator(v));
  };
  const source = (m: IndicatorMatch) =>
    m.source === 'blocklist'
      ? t('dash.sourceBlocklist')
      : m.source === 'community'
        ? t('dash.sourceCommunity')
        : t('dash.sourceBundled');
  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <form onSubmit={submit} className="surface flex flex-col gap-3 p-5 sm:flex-row sm:items-end">
        <div className="flex flex-1 flex-col gap-1.5">
          <label htmlFor={id} className="text-sm text-text-2">
            {t('dash.lookupLabel')}
          </label>
          <input
            id={id}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={t('dash.lookupPlaceholder')}
            autoCapitalize="off"
            spellCheck={false}
            maxLength={200}
            className="min-h-12 rounded-card border border-glass-border bg-surface-2 px-3 font-mono text-sm text-text outline-none placeholder:font-sans focus-visible:border-brand"
          />
        </div>
        <button type="submit" disabled={!value.trim()} className={buttonVariants({ size: 'lg' })}>
          <Search aria-hidden />
          {t('dash.lookupCheck')}
        </button>
      </form>
      <div aria-live="polite">
        {result === null && <p className="surface p-5 text-text">{t('dash.lookupNone')}</p>}
        {result && (
          <div className="surface flex flex-col gap-3 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono break-all">{result.value}</span>
              {result.sampleData && <SampleDataBadge />}
            </div>
            <p className="text-2xl font-semibold">{t('dash.lookupFound', { n: result.reports })}</p>
            <dl className="grid grid-cols-[8rem_minmax(0,1fr)] gap-2 text-sm">
              {result.category && (
                <>
                  <dt className="text-text-2">{t('dash.lookupCategory')}</dt>
                  <dd>{categoryText(result.category, lang).name}</dd>
                </>
              )}
              {result.campaign && (
                <>
                  <dt className="text-text-2">{t('dash.lookupCampaign')}</dt>
                  <dd className="font-mono">{result.campaign}</dd>
                </>
              )}
              <dt className="text-text-2">{t('dash.lookupSource')}</dt>
              <dd>{source(result)}</dd>
            </dl>
          </div>
        )}
      </div>
    </div>
  );
}

function Landscape() {
  const { t } = useTranslation();
  const lang = useAppStore((s) => s.lang);
  return (
    <RevealProvider>
      <div className="flex flex-col gap-4">
        <p className="flex flex-wrap items-center gap-2 text-sm text-text-2">
          <SampleDataBadge />
          {t('dash.landscapeNote')}
        </p>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card
            title={t('dash.byCategoryTitle')}
            extra={<SampleDataBadge />}
            className="lg:col-span-1"
          >
            <BarList rows={categoryRows(LANDSCAPE.byCategory, lang)} emptyText="" />
          </Card>
          <Card title={t('dash.byLang')} extra={<SampleDataBadge />}>
            <BarList
              rows={LANDSCAPE.byLang.map((r) => ({
                key: r.lang,
                label: t(`lang.${r.lang}`),
                value: r.count,
              }))}
              emptyText=""
            />
          </Card>
          <Card title={t('dash.byChannel')} extra={<SampleDataBadge />}>
            <BarList
              rows={LANDSCAPE.byChannel.map((r) => ({
                key: r.channel,
                label: t(`channel.${r.channel}`),
                value: r.count,
              }))}
              emptyText=""
            />
          </Card>
        </div>
        <Card title={t('dash.patternsTitle')}>
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {PATTERN_CARDS.map((p) => (
              <li key={p.id} className="rounded-card border border-glass-border bg-surface-2 p-4">
                <p className="text-xs text-text-2">{categoryText(p.category, lang).name}</p>
                <h3 className="mt-1 font-semibold">{l10n(p.title, lang)}</h3>
                <p className="mt-2 text-sm text-text">{l10n(p.body, lang)}</p>
                {p.sourceUrl && (
                  <a
                    href={p.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-sm text-brand underline-offset-4 hover:underline"
                  >
                    {t('dash.source')}
                    <ExternalLink className="size-3.5" aria-hidden />
                  </a>
                )}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </RevealProvider>
  );
}

const tabClass =
  'min-h-tap rounded-chip px-4 text-sm font-medium text-text-2 transition-colors outline-none hover:text-text focus-visible:outline-2 focus-visible:outline-brand data-[state=active]:bg-overlay/8 data-[state=active]:text-text';

/** Dashboard (§5.11): My shield, Lookup, Scam landscape. */
export default function DashboardPage() {
  const { t } = useTranslation();
  usePageTitle(t('page.dashboard.title'));
  return (
    <section
      aria-labelledby="page-title"
      className="mx-auto w-full max-w-6xl px-4 pt-8 sm:px-6 lg:pt-12"
    >
      <h1 id="page-title" className="text-xl font-semibold tracking-tight sm:text-2xl">
        {t('page.dashboard.title')}
      </h1>
      <p className="mt-2 max-w-2xl text-text-2">{t('page.dashboard.body')}</p>
      <Tabs.Root defaultValue="shield" className="mt-6">
        <Tabs.List
          aria-label={t('page.dashboard.title')}
          className="mb-5 inline-flex flex-wrap gap-1 rounded-card border border-glass-border bg-surface p-1"
        >
          <Tabs.Trigger value="shield" className={tabClass}>
            {t('dash.tabShield')}
          </Tabs.Trigger>
          <Tabs.Trigger value="lookup" className={tabClass}>
            {t('dash.tabLookup')}
          </Tabs.Trigger>
          <Tabs.Trigger value="landscape" className={tabClass}>
            {t('dash.tabLandscape')}
          </Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="shield" className="outline-none">
          <Shield />
        </Tabs.Content>
        <Tabs.Content value="lookup" className="outline-none">
          <Lookup />
        </Tabs.Content>
        <Tabs.Content value="landscape" className="outline-none">
          <Landscape />
        </Tabs.Content>
      </Tabs.Root>
    </section>
  );
}
