import { FlaskConical } from 'lucide-react';
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { usePageTitle } from '@/hooks/usePageTitle';
import { allScans, type ScanRecord } from '@/lib/db';
import { buildEntityGraph, type GraphNode } from '@/lib/engine';
import { ALL_TYPES, filterGraph, neighbours, scansMentioning, type NodeType } from '@/lib/graph';
import { VERDICT_ICON } from '@/lib/risk';
import { cn } from '@/lib/utils';

const ForceGraphView = lazy(() => import('@/components/network/ForceGraphView'));

const TYPE_DOT: Record<NodeType, string> = {
  phone: 'bg-[#25b8ff] rounded-full',
  upi: 'bg-[#3de0ff] rotate-45',
  domain: 'bg-[#8fb3ff]',
  campaign: 'bg-[#b04dff] rounded-[3px]',
};

const TYPE_LABEL_KEY: Record<NodeType, string> = {
  phone: 'network.typePhone',
  upi: 'network.typeUpi',
  domain: 'network.typeDomain',
  campaign: 'network.typeCampaign',
};

export function canvasSupported(): boolean {
  try {
    return !!document.createElement('canvas').getContext('2d');
  } catch {
    return false;
  }
}

function EntityPanel({
  node,
  graph,
  scans,
  onClose,
}: {
  node: GraphNode | null;
  graph: ReturnType<typeof buildEntityGraph>;
  scans: ScanRecord[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const campaigns = node
    ? graph.nodes.filter((n) => n.type === 'campaign' && neighbours(graph, node.id).has(n.id))
    : [];
  const mentions = node ? scansMentioning(scans, node) : [];
  return (
    <Sheet open={!!node} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" closeLabel={t('shell.close')}>
        {node && (
          <>
            <div>
              <p className="text-xs tracking-wide text-text-2 uppercase">
                {t(TYPE_LABEL_KEY[node.type])}
              </p>
              <SheetTitle className="mt-1 pr-10 font-mono text-base break-all">
                {node.label}
              </SheetTitle>
              <SheetDescription className="mt-2 flex flex-wrap items-center gap-2">
                <span>{t('network.panelReports', { n: node.reports })}</span>
                {node.sampleData && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-glass-border px-2 py-0.5 text-xs">
                    <FlaskConical className="size-3" aria-hidden />
                    {t('placeholder.sampleData')}
                  </span>
                )}
                {node.mine && (
                  <span className="rounded-full border border-brand/40 px-2 py-0.5 text-xs text-brand">
                    {t('network.legendMine')}
                  </span>
                )}
              </SheetDescription>
            </div>
            {campaigns.length > 0 && (
              <div>
                <h3 className="text-sm font-medium">{t('network.panelCampaigns')}</h3>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {campaigns.map((c) => (
                    <li
                      key={c.id}
                      className="rounded-chip border border-ai/40 bg-ai/10 px-2.5 py-1 font-mono text-xs"
                    >
                      {c.label}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div>
              <h3 className="text-sm font-medium">{t('network.panelScans')}</h3>
              {mentions.length === 0 ? (
                <p className="mt-1 text-sm text-text-2">{t('network.panelNoScans')}</p>
              ) : (
                <ul className="mt-2 flex flex-col gap-1">
                  {mentions.slice(0, 10).map((s) => {
                    const Icon = VERDICT_ICON[s.verdict];
                    return (
                      <li key={s.id}>
                        <Link
                          to={`/scan/${s.id}`}
                          onClick={onClose}
                          className="flex min-h-tap items-center gap-2 rounded-chip px-2 text-sm hover:bg-overlay/5"
                        >
                          <Icon className="size-4 shrink-0 text-text-2" aria-hidden />
                          <span className="truncate">{s.inputPreview}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

/** Network graph (§5.12, M9.1). */
export default function NetworkPage() {
  const { t } = useTranslation();
  usePageTitle(t('page.network.title'));
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [types, setTypes] = useState<Set<NodeType>>(new Set(ALL_TYPES));
  const [onlyMine, setOnlyMine] = useState(false);
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [canvasOk] = useState(canvasSupported);

  useEffect(() => {
    void allScans().then(setScans);
  }, []);

  const graph = useMemo(
    () =>
      buildEntityGraph(
        scans.map((s) => s.result),
        { includeBundled: true },
      ),
    [scans],
  );
  const shown = useMemo(() => filterGraph(graph, { types, onlyMine }), [graph, types, onlyMine]);

  // Campaign Match's "See it on the network": /network?campaign=<id> lights up that campaign
  const [params, setParams] = useSearchParams();
  const spotCampaign = params.get('campaign');
  const spotId =
    spotCampaign && shown.nodes.some((n) => n.id === `campaign:${spotCampaign}`)
      ? `campaign:${spotCampaign}`
      : null;
  const spotLinked = useMemo(() => {
    if (!spotId) return null;
    const ids = neighbours(graph, spotId);
    ids.delete(spotId);
    const mine = graph.nodes.filter((n) => ids.has(n.id) && n.mine).length;
    return { n: ids.size, mine };
  }, [graph, spotId]);

  const toggle = (ty: NodeType) =>
    setTypes((s) => {
      const n = new Set(s);
      if (n.has(ty)) n.delete(ty);
      else n.add(ty);
      return n;
    });

  return (
    <section
      aria-labelledby="page-title"
      className="mx-auto w-full max-w-6xl px-4 pt-8 sm:px-6 lg:pt-12"
    >
      <h1 id="page-title" className="text-xl font-semibold tracking-tight sm:text-2xl">
        {t('page.network.title')}
      </h1>
      <p className="mt-2 max-w-2xl text-text-2">{t('page.network.body')}</p>

      <div
        className="mt-6 flex flex-wrap items-center gap-2"
        role="group"
        aria-label={t('network.filters')}
      >
        {ALL_TYPES.map((ty) => (
          <button
            key={ty}
            type="button"
            aria-pressed={types.has(ty)}
            onClick={() => toggle(ty)}
            className={cn(
              'inline-flex min-h-10 items-center gap-2 rounded-chip border px-3 text-sm outline-none focus-visible:outline-2 focus-visible:outline-brand',
              types.has(ty)
                ? 'border-brand/40 bg-brand/10 text-text'
                : 'border-glass-border text-text-2',
            )}
          >
            <span className={cn('size-2.5', TYPE_DOT[ty])} aria-hidden />
            {t(`network.${ty}`)}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={onlyMine}
          onClick={() => setOnlyMine((v) => !v)}
          className={cn(
            'inline-flex min-h-10 items-center gap-2 rounded-chip border px-3 text-sm outline-none focus-visible:outline-2 focus-visible:outline-brand',
            onlyMine ? 'border-brand/40 bg-brand/10 text-text' : 'border-glass-border text-text-2',
          )}
        >
          <span className="size-3 rounded-full border-2 border-brand" aria-hidden />
          {t('network.onlyMine')}
        </button>
      </div>

      <p className="mt-3 text-sm text-text-2" aria-live="polite">
        {t('network.stats', {
          clusters: graph.stats.clusters,
          largest: graph.stats.largestCluster,
        })}
      </p>

      {spotId && spotLinked && (
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-card border border-[#b04dff]/50 bg-[#b04dff]/10 px-4 py-3 text-sm text-text">
          <p>
            {t('network.spotlight', {
              campaign: t(`campaigns.${spotCampaign}`, { defaultValue: spotCampaign ?? '' }),
              n: spotLinked.n,
            })}
            {spotLinked.mine > 0 && ` ${t('network.spotlightMine', { n: spotLinked.mine })}`}
          </p>
          <button
            type="button"
            onClick={() => setParams({}, { replace: true })}
            className="ml-auto min-h-9 rounded-chip border border-glass-border px-3 text-sm outline-none hover:bg-overlay/6 focus-visible:outline-2 focus-visible:outline-brand"
          >
            {t('network.clearSpotlight')}
          </button>
        </div>
      )}

      <div className="mt-4">
        {shown.nodes.length === 0 ? (
          <p className="surface p-8 text-center text-text-2">{t('network.empty')}</p>
        ) : canvasOk ? (
          <Suspense
            fallback={
              <div className="surface grid h-[420px] place-items-center text-sm text-text-2">
                {t('network.loading')}
              </div>
            }
          >
            <ForceGraphView
              graph={shown}
              selectedId={selected?.id ?? spotId}
              onSelect={setSelected}
              zoomTo={spotId}
            />
          </Suspense>
        ) : (
          <p className="surface p-6 text-sm text-text-2">{t('network.noGraph')}</p>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-text-2">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded-full border-2 border-brand" aria-hidden />
          {t('network.legendMine')}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded-full bg-text-2/40" aria-hidden />
          {t('network.legendSample')}
        </span>
      </div>

      {/* Keyboard and screen-reader path to every node */}
      <ul className="mt-6 flex flex-wrap gap-2" aria-label={t('page.network.title')}>
        {shown.nodes.map((n) => (
          <li key={n.id}>
            <button
              type="button"
              onClick={() => setSelected(n)}
              className={cn(
                'inline-flex min-h-9 items-center gap-2 rounded-chip border px-2.5 font-mono text-xs outline-none focus-visible:outline-2 focus-visible:outline-brand',
                n.mine ? 'border-brand/50' : 'border-glass-border',
                n.sampleData && 'opacity-70',
              )}
            >
              <span className={cn('size-2', TYPE_DOT[n.type])} aria-hidden />
              <span className="sr-only">{t(TYPE_LABEL_KEY[n.type])}: </span>
              {n.label}
            </button>
          </li>
        ))}
      </ul>

      <EntityPanel node={selected} graph={graph} scans={scans} onClose={() => setSelected(null)} />
    </section>
  );
}
