import { ArrowRight, FlaskConical } from 'lucide-react';
import { AnimatePresence, m } from 'motion/react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { REVEAL_MS, useCountUp, useRevealTransition } from '@/components/analysis/reveal';
import { inr, linear, niceMax } from '@/lib/charts';
import type { ScanRecord } from '@/lib/db';
import { buildEntityGraph, categoryText, type EntityGraph, type ScamCategory } from '@/lib/engine';
import { spring } from '@/lib/motion';
import { VERDICT_COLOR, VERDICT_ICON } from '@/lib/risk';
import { useAppStore } from '@/lib/store';

export function SampleDataBadge() {
  const { t } = useTranslation();
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-glass-border px-2 py-0.5 text-xs text-text-2">
      <FlaskConical className="size-3" aria-hidden />
      {t('placeholder.sampleData')}
    </span>
  );
}

/** KPI tile with a count-up (§5.11); instant under reduced motion. */
export function KpiTile({
  label,
  value,
  money = false,
  delayMs = 0,
}: {
  label: string;
  value: number;
  money?: boolean;
  delayMs?: number;
}) {
  const shown = useCountUp(value, delayMs, 800);
  return (
    <div className="surface flex flex-col gap-1 p-4 sm:p-5">
      <span className="text-sm text-text-2">{label}</span>
      <span className="font-mono text-2xl font-semibold tabular-nums" aria-hidden>
        {money ? inr(shown) : shown.toLocaleString('en-IN')}
      </span>
      <span className="sr-only">{money ? inr(value) : value}</span>
    </div>
  );
}

/** Latest checks; new ones slide in when another tab broadcasts a scan (M8.2). */
export function RecentDetectionsFeed({
  scans,
  isSample,
}: {
  scans: ScanRecord[];
  /** marks sample checks with a "Sample" tag */
  isSample?: (id: string) => boolean;
}) {
  const { t } = useTranslation();
  const lang = useAppStore((s) => s.lang);
  const fmt = new Intl.DateTimeFormat(lang === 'en' ? 'en-IN' : `${lang}-IN`, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  if (!scans.length) return <p className="text-text-2">{t('dash.recentEmpty')}</p>;
  return (
    <ul className="flex flex-col gap-1" aria-live="polite">
      <AnimatePresence initial={false}>
        {scans.slice(0, 20).map((s) => {
          const Icon = VERDICT_ICON[s.verdict];
          return (
            <m.li
              key={s.id}
              layout
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={spring.ui}
            >
              <Link
                to={`/scan/${s.id}`}
                className="flex min-h-tap items-center gap-3 rounded-chip px-2 py-2 hover:bg-overlay/5 outline-none focus-visible:outline-2 focus-visible:outline-brand"
              >
                <Icon
                  className="size-5 shrink-0"
                  style={{ color: VERDICT_COLOR[s.verdict] }}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="font-medium">
                      {isSample?.(s.id) && (
                        <span className="mr-1.5 rounded-full border border-glass-border px-1.5 py-0.5 align-middle text-[0.7rem] font-normal text-text-2">
                          {t('dash.sampleTag')}
                        </span>
                      )}
                      {t(`verdict.${s.verdict}`)}
                      {s.category && (
                        <span className="text-text-2">
                          {' '}
                          · {categoryText(s.category, lang).name}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 font-mono text-xs text-text-2">{s.riskScore}</span>
                  </span>
                  <span className="block truncate text-sm text-text-2">{s.inputPreview}</span>
                  <span className="block text-xs text-text-2/80">
                    {fmt.format(new Date(s.createdAt))}
                  </span>
                </span>
              </Link>
            </m.li>
          );
        })}
      </AnimatePresence>
    </ul>
  );
}

/** Horizontal bars with labels; brand shade (counts, not risk levels). */
export function BarList({
  rows,
  emptyText,
}: {
  rows: { key: string; label: string; value: number }[];
  emptyText: string;
}) {
  const tr = useRevealTransition();
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return <p className="text-sm text-text-2">{emptyText}</p>;
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((r, i) => (
        <li
          key={r.key}
          className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_3rem] items-center gap-3 text-sm"
        >
          <span className="truncate">{r.label}</span>
          <span className="h-2.5 overflow-hidden rounded-full bg-overlay/6" aria-hidden>
            <m.span
              className="block h-full rounded-full bg-brand/70"
              style={{ originX: 0 }}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: r.value / max }}
              transition={tr(REVEAL_MS.gauge + i * 50, 0.5)}
            />
          </span>
          <span className="text-right font-mono text-xs tabular-nums">
            {r.value.toLocaleString('en-IN')}
          </span>
        </li>
      ))}
    </ul>
  );
}

const AW = 560;
const AH = 140;
const AP = { l: 28, r: 8, t: 10, b: 22 };

export function areaPath(
  values: number[],
  max: number,
): { line: string; area: string; points: { x: number; y: number }[] } {
  const n = values.length;
  const x = linear(0, Math.max(1, n - 1), AP.l, AW - AP.r);
  const y = linear(0, max, AH - AP.b, AP.t);
  const points = values.map((v, i) => ({ x: x(i), y: y(v) }));
  const line = points
    .map((p, i) => `${i ? 'L' : 'M'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');
  const area = points.length
    ? `${line} L ${points.at(-1)!.x.toFixed(1)} ${AH - AP.b} L ${points[0]!.x.toFixed(1)} ${AH - AP.b} Z`
    : '';
  return { line, area, points };
}

/** Checks per day (area) with warnings per day (line), last 14 days (M8.3). */
export function DayArea({ days }: { days: { day: string; scans: number; threats: number }[] }) {
  const { t } = useTranslation();
  const tr = useRevealTransition();
  const max = niceMax(Math.max(1, ...days.map((d) => d.scans)));
  const all = areaPath(
    days.map((d) => d.scans),
    max,
  );
  const warn = areaPath(
    days.map((d) => d.threats),
    max,
  );
  return (
    <figure>
      <svg
        viewBox={`0 0 ${AW} ${AH}`}
        className="h-auto w-full"
        role="img"
        aria-label={t('dash.byDayTitle')}
      >
        {[0, max / 2, max].map((v) => {
          const yy = linear(0, max, AH - AP.b, AP.t)(v);
          return (
            <g key={v}>
              <line
                x1={AP.l}
                x2={AW - AP.r}
                y1={yy}
                y2={yy}
                stroke="var(--text-2)"
                strokeOpacity={0.12}
              />
              <text
                x={AP.l - 6}
                y={yy + 4}
                textAnchor="end"
                fontSize="10"
                fill="var(--text-2)"
                className="font-mono"
              >
                {Math.round(v)}
              </text>
            </g>
          );
        })}
        <m.path
          d={all.area}
          fill="var(--brand)"
          fillOpacity={0.14}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={tr(150, 0.5)}
        />
        <path d={all.line} fill="none" stroke="var(--brand)" strokeWidth={2} />
        <path
          d={warn.line}
          fill="none"
          stroke="var(--risk-warn)"
          strokeWidth={2}
          strokeDasharray="4 3"
        />
        {days.map((d, i) =>
          i % 2 === 0 || i === days.length - 1 ? (
            <text
              key={d.day}
              x={all.points[i]!.x}
              y={AH - 6}
              textAnchor="middle"
              fontSize="10"
              fill="var(--text-2)"
              className="font-mono"
            >
              {d.day.slice(8)}
            </text>
          ) : null,
        )}
      </svg>
      <figcaption className="mt-1 flex gap-4 text-xs text-text-2">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 bg-brand" aria-hidden />
          {t('dash.kScans')}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 bg-risk-warn" aria-hidden />
          {t('dash.kThreats')}
        </span>
      </figcaption>
      <table className="sr-only">
        <tbody>
          {days.map((d) => (
            <tr key={d.day}>
              <th>{d.day}</th>
              <td>{d.scans}</td>
              <td>{d.threats}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

const NODE_COLOR: Record<EntityGraph['nodes'][number]['type'], string> = {
  phone: 'var(--brand)',
  upi: 'color-mix(in srgb, var(--brand) 60%, var(--text))',
  domain: 'var(--text-2)',
  campaign: 'var(--ai)',
};

/** Small static preview of the entity graph; the full graph is on /network (M9.1 in P4). */
export function NetworkPreview({ scans }: { scans: ScanRecord[] }) {
  const { t } = useTranslation();
  const graph = useMemo(
    () =>
      buildEntityGraph(
        scans.map((s) => s.result),
        { includeBundled: true },
      ),
    [scans],
  );
  const W = 260;
  const H = 150;
  const pos = new Map(
    graph.nodes.map((n, i) => {
      const a = (i / Math.max(1, graph.nodes.length)) * Math.PI * 2;
      const r = n.type === 'campaign' ? 22 : 58;
      return [n.id, { x: W / 2 + Math.cos(a) * r * 1.6, y: H / 2 + Math.sin(a) * r }];
    }),
  );
  return (
    <div className="flex flex-col gap-3">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full max-w-sm"
        role="img"
        aria-label={t('dash.networkBody', {
          nodes: graph.nodes.length,
          clusters: graph.stats.clusters,
        })}
      >
        {graph.edges.map((e, i) => {
          const a = pos.get(e.source);
          const b = pos.get(e.target);
          return a && b ? (
            <line
              key={i}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="var(--text-2)"
              strokeOpacity={0.3}
            />
          ) : null;
        })}
        {graph.nodes.map((n) => {
          const p = pos.get(n.id)!;
          return (
            <circle
              key={n.id}
              cx={p.x}
              cy={p.y}
              r={4 + Math.min(6, n.reports)}
              fill={NODE_COLOR[n.type]}
              fillOpacity={n.sampleData ? 0.55 : 1}
              stroke={n.mine ? 'var(--brand)' : 'none'}
              strokeWidth={2}
            />
          );
        })}
      </svg>
      <p className="text-sm text-text-2">
        {t('dash.networkBody', { nodes: graph.nodes.length, clusters: graph.stats.clusters })}
      </p>
      <Link
        to="/network"
        className="inline-flex items-center gap-1.5 self-start text-sm text-brand underline-offset-4 hover:underline"
      >
        {t('dash.openNetwork')}
        <ArrowRight className="size-4" aria-hidden />
      </Link>
    </div>
  );
}

export function categoryRows(
  rows: { category: ScamCategory; count: number }[],
  lang: Parameters<typeof categoryText>[1],
) {
  return rows.map((r) => ({
    key: r.category,
    label: categoryText(r.category, lang).name,
    value: r.count,
  }));
}
