import '@/styles/network.css';
import { ArrowUp, FlaskConical, Minus, Plus, ScanSearch, TriangleAlert, X } from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';
import type { NetLayout, NetShow, ScamNetworkHandle } from '@/components/network/ScamNetworkCanvas';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useSampleHistory } from '@/hooks/useSampleHistory';
import { subscribe } from '@/lib/broadcast';
import type { CampaignSamplesData } from '@/lib/campaignMatch';
import {
  addToBlocklist,
  allScans,
  listBlocklist,
  removeFromBlocklist,
  type BlockEntry,
  type ScanRecord,
} from '@/lib/db';
import { categoryText, loadCampaignSamples } from '@/lib/engine';
import {
  buildScamNetwork,
  CORE_ID,
  dailyActivity,
  findNode,
  linkedTo,
  monthEnd,
  recentMonths,
  type NetNode,
  type ScamNetwork,
} from '@/lib/scamNetwork';
import { useAppStore } from '@/lib/store';

const ScamNetworkCanvas = lazy(() =>
  import('@/components/network/ScamNetworkCanvas').then((m) => ({ default: m.ScamNetworkCanvas })),
);

/** Campaigns at this risk and above are "Scam" (red); the canvas uses the same line. */
const HIGH_RISK = 85;
const REPORT_URL = 'https://cybercrime.gov.in';

export function canvasSupported(): boolean {
  try {
    return !!document.createElement('canvas').getContext('2d');
  } catch {
    return false;
  }
}

function Shield({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6l7-3z" />
      <path d="M8.5 12s1.3-2.5 3.5-2.5 3.5 2.5 3.5 2.5-1.3 2.5-3.5 2.5-3.5-2.5-3.5-2.5z" />
    </svg>
  );
}

/** The activity wave and month buttons on the left (checks per day from your history). */
function MonthScrubber({
  months,
  month,
  onMonth,
  activity,
  label,
  monthName,
}: {
  months: string[];
  month: number;
  onMonth: (i: number) => void;
  activity: number[];
  label: string;
  monthName: (m: string, long: boolean) => string;
}) {
  const wrap = useRef<HTMLElement>(null);
  const wave = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = wrap.current;
    const cv = wave.current;
    if (!el || !cv) return;
    const draw = () => {
      const r = el.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.round(r.width * dpr);
      cv.height = Math.round(r.height * dpr);
      const cx = cv.getContext('2d');
      if (!cx) return;
      cx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const h = r.height - 40;
      const max = Math.max(1, ...activity);
      const perMonth = activity.length / months.length;
      cx.fillStyle = 'rgba(61,224,255,.9)';
      activity.forEach((v, i) => {
        const y = 20 + (i / Math.max(1, activity.length - 1)) * h;
        cx.globalAlpha = i / perMonth <= month + 0.999 ? 0.5 : 0.14;
        cx.fillRect(4, y, 3 + (v / max) * 24, 1);
      });
      cx.globalAlpha = 1;
      const y = 20 + (month / Math.max(1, months.length - 1)) * h;
      cx.strokeStyle = 'rgba(61,224,255,.9)';
      cx.beginPath();
      cx.moveTo(0, y);
      cx.lineTo(30, y);
      cx.stroke();
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(el);
    return () => ro.disconnect();
  }, [activity, month, months.length]);
  return (
    <>
      <nav ref={wrap} className="sn-tl" aria-label={label}>
        <canvas ref={wave} aria-hidden />
        {months.map((m, i) => (
          <button
            key={m}
            type="button"
            className="sn-mo"
            aria-pressed={i === month}
            style={{ top: `calc(20px + ${i / Math.max(1, months.length - 1)} * (100% - 40px))` }}
            onClick={() => onMonth(i)}
          >
            {monthName(m, i === month)}
          </button>
        ))}
      </nav>
      <nav className="sn-months-row" aria-label={label}>
        {months.map((m, i) => (
          <button key={m} type="button" aria-pressed={i === month} onClick={() => onMonth(i)}>
            {monthName(m, true)}
          </button>
        ))}
      </nav>
    </>
  );
}

/** Scam network (§5.12, redesigned 2026-11-21 to the "Scam network V2" design). */
export default function NetworkPage() {
  const { t, i18n } = useTranslation();
  usePageTitle(t('page.network.title'));
  const lang = useAppStore((s) => s.lang);
  const [own, setOwn] = useState<ScanRecord[] | null>(null);
  const [blocked, setBlocked] = useState<BlockEntry[]>([]);
  const [data, setData] = useState<CampaignSamplesData | null>(null);
  const [canvasOk] = useState(canvasSupported);
  const sample = useSampleHistory(own);

  const refreshBlocked = useCallback(() => void listBlocklist().then(setBlocked), []);
  useEffect(() => {
    void allScans().then(setOwn);
    refreshBlocked();
    void loadCampaignSamples().then(setData);
    return subscribe((msg) => {
      if (msg.type === 'blocklist') refreshBlocked();
      if (msg.type === 'scan') void allScans().then(setOwn);
    });
  }, [refreshBlocked]);

  // the top bar goes dark over the console
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('nav-night');
    return () => root.classList.remove('nav-night');
  }, []);

  const [now] = useState(() => new Date());
  const months = useMemo(() => recentMonths(now), [now]);
  const [month, setMonth] = useState(months.length - 1);
  const checks = useMemo(() => [...(own ?? []), ...sample.samples], [own, sample.samples]);
  const net: ScamNetwork | null = useMemo(() => {
    if (!data) return null;
    const m = months[month]!;
    const [y, mm] = m.split('-').map(Number) as [number, number];
    return buildScamNetwork({
      data,
      checks,
      blocked,
      until: monthEnd(m),
      monthStart: new Date(y, mm - 1, 1),
    });
  }, [data, checks, blocked, months, month]);
  const activity = useMemo(() => dailyActivity(checks, months), [checks, months]);

  const [mode, setMode] = useState<NetLayout>('orbit');
  const [show, setShow] = useState<NetShow>({ camp: true, chan: true, det: true });
  const [riskOnly, setRiskOnly] = useState(false);
  const [lensOn, setLensOn] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [answer, setAnswer] = useState<{ text: string; none?: boolean } | null>(null);
  const canvas = useRef<ScamNetworkHandle>(null);

  // Campaign Match's "See it on the network": /network?campaign=<id>
  const [params] = useSearchParams();
  const wanted = params.get('campaign');
  const followed = useRef<string | null>(null);
  useEffect(() => {
    // once per link followed, not on every rebuild (month, blocklist)
    if (!net || !wanted || followed.current === wanted) return;
    followed.current = wanted;
    const id = `camp:${wanted}`;
    if (!net.nodes.some((n) => n.id === id)) return;
    setSelected(id);
    setFocusId(id);
  }, [wanted, net]);

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelected(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected]);

  const byId = useMemo(() => new Map(net?.nodes.map((n) => [n.id, n]) ?? []), [net]);
  const campaignName = useCallback(
    (key: string) => t(`campaigns.${key}`, { defaultValue: key }),
    [t],
  );
  const channelName = useCallback(
    (key: string) => t(`net.chan.${key}`, { defaultValue: key }),
    [t],
  );
  const campsOf = useCallback(
    (n: NetNode) =>
      net
        ? [...linkedTo(net, n.id)]
            .map((id) => byId.get(id))
            .filter((c): c is NetNode => c?.kind === 'camp')
        : [],
    [net, byId],
  );

  const label = useCallback(
    (n: NetNode): { name: string; pill: string } => {
      if (n.kind === 'core')
        return {
          name: t('net.yourChecks'),
          pill: t('net.pillChecked', { n: net?.stats.checks ?? 0 }),
        };
      if (n.kind === 'camp')
        return {
          name: campaignName(n.key),
          pill: `${t('net.pillRisk', { risk: n.risk })} · ${
            n.found ? t('net.pillFound', { n: n.found }) : t('net.pillReports', { n: n.reports })
          }`,
        };
      if (n.kind === 'chan')
        return { name: channelName(n.key), pill: t('net.pillCampaigns', { n: campsOf(n).length }) };
      return { name: n.key, pill: '' };
    },
    [t, net, campaignName, channelName, campsOf],
  );

  const select = (id: string | null) => {
    setSelected(id);
    if (id) setFocusId(id);
  };

  // storage can be unavailable (some private modes): then nothing changes and the card stays as is
  const block = async (n: NetNode, on: boolean) => {
    if (!n.detail) return;
    try {
      if (on) await addToBlocklist(n.key, n.detail);
      else await removeFromBlocklist(n.key.trim().toLowerCase());
    } catch {
      /* not saved */
    }
    refreshBlocked();
  };
  const blockAll = async (camp: NetNode) => {
    if (!net) return;
    try {
      for (const d of net.nodes)
        if (d.kind === 'det' && d.parent === camp.id && !d.blocked && d.detail)
          await addToBlocklist(d.key, d.detail);
    } catch {
      /* not saved */
    }
    refreshBlocked();
  };

  const names = useCallback(
    (n: NetNode): string[] => {
      if (n.kind === 'camp')
        return [
          campaignName(n.key),
          n.key.replace(/-/g, ' '),
          n.category ? categoryText(n.category, lang).name : '',
        ];
      if (n.kind === 'chan') return [channelName(n.key), n.key];
      if (n.kind === 'core') return [t('net.yourChecks')];
      return [n.key];
    },
    [campaignName, channelName, lang, t],
  );

  const ask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!net) return;
    const n = findNode(net, query, names);
    if (!n) {
      setAnswer({ text: t('net.answerNone'), none: true });
      return;
    }
    select(n.id);
    if (n.kind === 'camp') {
      const details = net.nodes.filter((d) => d.kind === 'det' && d.parent === n.id).length;
      const desc = n.category ? categoryText(n.category, lang).oneLiner : '';
      setAnswer({
        text: `${t('net.answerCamp', {
          name: campaignName(n.key),
          risk: n.risk,
          details,
          reports: n.reports,
        })}${n.found ? ` ${t('net.answerFound', { n: n.found })}` : ''} ${desc}`.trim(),
      });
    } else if (n.kind === 'chan') {
      setAnswer({
        text: t('net.answerChan', {
          name: channelName(n.key),
          campaigns: campsOf(n)
            .map((c) => campaignName(c.key))
            .join(', '),
        }),
      });
    } else if (n.kind === 'det') {
      const parent = byId.get(n.parent ?? '');
      setAnswer({
        text: t('net.answerDet', {
          value: n.key,
          campaign: parent ? campaignName(parent.key) : '',
          reports: n.reports,
        }),
      });
    } else if (n.kind === 'mine') {
      setAnswer({ text: t('net.answerMine', { value: n.key }) });
    } else {
      setAnswer({ text: t('net.coreBody') });
    }
  };

  const monthName = useCallback(
    (m: string, long: boolean) => {
      const [y, mm] = m.split('-').map(Number) as [number, number];
      const d = new Date(y, mm - 1, 1);
      return long
        ? d.toLocaleDateString(i18n.language, { month: 'short', year: 'numeric' })
        : d.toLocaleDateString(i18n.language, { month: 'short' }).toUpperCase();
    },
    [i18n.language],
  );

  const card = (n: NetNode) => {
    if (!net) return null;
    const close = (
      <button
        type="button"
        className="x"
        onClick={() => setSelected(null)}
        aria-label={t('net.close')}
      >
        <X size={16} aria-hidden />
      </button>
    );
    if (n.kind === 'core')
      return (
        <section aria-label={t('net.yourChecks')}>
          {close}
          <span className="k cy">{t('net.coreKind')}</span>
          <h2>{t('net.yourChecks')}</h2>
          <p>{t('net.coreBody')}</p>
          <div className="row">
            <div>
              <b>{net.stats.checks}</b>
              <span>{t('net.kChecked')}</span>
            </div>
            <div>
              <b>{net.stats.campaignsFound}</b>
              <span>{t('net.kCampaigns')}</span>
            </div>
          </div>
        </section>
      );
    if (n.kind === 'camp') {
      const dets = net.nodes.filter((d) => d.kind === 'det' && d.parent === n.id);
      const high = (n.risk ?? 0) >= HIGH_RISK;
      const allBlocked = dets.every((d) => d.blocked);
      return (
        <section aria-label={campaignName(n.key)}>
          {close}
          <span className={high ? 'k' : 'k am'}>● {t('net.campKindScam', { risk: n.risk })}</span>
          <h2>{campaignName(n.key)}</h2>
          <p>{n.category ? categoryText(n.category, lang).oneLiner : ''}</p>
          <div className="row">
            <div>
              <b>{n.found ?? 0}</b>
              <span>{t('net.campFound')}</span>
            </div>
            <div>
              <b>{dets.length}</b>
              <span>{t('net.campDetails')}</span>
            </div>
            <div>
              <b>{n.reports}</b>
              <span>{t('net.campReports')}</span>
            </div>
          </div>
          <div className="a">
            <button
              type="button"
              className="p"
              disabled={allBlocked}
              onClick={() => void blockAll(n)}
            >
              {allBlocked ? t('net.allBlocked') : t('net.blockAll')}
            </button>
            <a href={REPORT_URL} target="_blank" rel="noreferrer">
              {t('net.report')} ↗
            </a>
          </div>
        </section>
      );
    }
    if (n.kind === 'chan')
      return (
        <section aria-label={channelName(n.key)}>
          {close}
          <span className="k cy">{t('net.chanKind')}</span>
          <h2>{channelName(n.key)}</h2>
          <p>
            {t('net.chanBody', {
              campaigns: campsOf(n)
                .map((c) => campaignName(c.key))
                .join(', '),
            })}
          </p>
          <p>{t('net.chanMessages', { n: n.messages })}</p>
        </section>
      );
    const kindName = t(`net.detKind.${n.detail ?? 'domain'}`);
    if (n.kind === 'mine')
      return (
        <section aria-label={n.key}>
          {close}
          <span className="k cy">{t('net.mineKind')}</span>
          <h2 className="mono">{n.key}</h2>
          <p>{`${kindName}. ${t('net.mineBody')}`}</p>
          <div className="a">
            <button type="button" className="p" onClick={() => void block(n, !n.blocked)}>
              {n.blocked ? t('net.unblock') : t('net.block')}
            </button>
            <a href={REPORT_URL} target="_blank" rel="noreferrer">
              {t('net.report')} ↗
            </a>
          </div>
        </section>
      );
    const parent = byId.get(n.parent ?? '');
    return (
      <section aria-label={n.key}>
        {close}
        <span className={n.blocked ? 'k' : 'k cy'}>
          {kindName} · {n.blocked ? t('net.isBlocked') : t('net.notBlocked')}
        </span>
        <h2 className="mono">{n.key}</h2>
        <p>
          {t('net.detBody', {
            n: n.reports,
            campaign: parent ? campaignName(parent.key) : '',
          })}
          {n.mine ? ` ${t('net.detMine')}` : ''}
        </p>
        <div className="a">
          <button type="button" className="p" onClick={() => void block(n, !n.blocked)}>
            {n.blocked ? t('net.unblock') : t('net.block')}
          </button>
          <a href={REPORT_URL} target="_blank" rel="noreferrer">
            {t('net.report')} ↗
          </a>
        </div>
      </section>
    );
  };

  const counts = useMemo(() => {
    const c = { camp: 0, chan: 0, det: 0 };
    for (const n of net?.nodes ?? []) {
      if (n.kind === 'camp') c.camp += 1;
      if (n.kind === 'chan') c.chan += 1;
      if (n.kind === 'det' || n.kind === 'mine') c.det += 1;
    }
    return c;
  }, [net]);
  const selNode = selected ? byId.get(selected) : undefined;
  const legendItems: { k: keyof NetShow; label: string; n: number; sw: React.ReactNode }[] = [
    {
      k: 'camp',
      label: t('net.campaigns'),
      n: counts.camp,
      sw: (
        <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden>
          <path d="M12 2l8.7 5v10L12 22l-8.7-5V7z" fill="#ff3b5c" />
        </svg>
      ),
    },
    {
      k: 'chan',
      label: t('net.channels'),
      n: counts.chan,
      sw: (
        <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden>
          <circle cx="12" cy="12" r="9" fill="#111826" stroke="#93a1b5" strokeWidth="2" />
        </svg>
      ),
    },
    {
      k: 'det',
      label: t('net.details'),
      n: counts.det,
      sw: (
        <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden>
          <circle cx="12" cy="12" r="5" fill="#b8c6d6" />
        </svg>
      ),
    },
  ];

  return (
    <>
      <section className="sn-app" aria-labelledby="page-title">
        {net && canvasOk ? (
          <Suspense fallback={null}>
            <ScamNetworkCanvas
              ref={canvas}
              net={net}
              mode={mode}
              show={show}
              riskOnly={riskOnly}
              lensOn={lensOn}
              selected={selected}
              onSelect={select}
              label={label}
              focusId={focusId}
              ariaLabel={t('net.canvas')}
              lensTitle={t('net.lensTitle')}
              card={selNode ? card(selNode) : null}
            />
          </Suspense>
        ) : (
          // no canvas (very old browsers, tests): the card still opens from the list below
          <div className="sn-stage">
            {selNode && <div className="sn-card sn-card-static">{card(selNode)}</div>}
          </div>
        )}

        <header className="sn-top">
          <div className="sn-brand sn-glass">
            <span className="ic">
              <Shield />
            </span>
            <div>
              <h1 id="page-title">{t('page.network.title')}</h1>
              <span>{t('net.sub')}</span>
            </div>
          </div>
          <div className="sn-bar">
            <div className="sn-grp sn-glass" role="group" aria-label={t('net.layout')}>
              <button
                type="button"
                aria-pressed={mode === 'orbit'}
                onClick={() => setMode('orbit')}
              >
                {t('net.orbit')}
              </button>
              <button type="button" aria-pressed={mode === 'tree'} onClick={() => setMode('tree')}>
                {t('net.tree')}
              </button>
            </div>
            <div className="sn-grp sn-glass" role="group" aria-label={t('net.zoom')}>
              <button
                type="button"
                aria-label={t('net.zoomOut')}
                onClick={() => canvas.current?.zoomBy(0.8)}
              >
                <Minus aria-hidden />
              </button>
              <button
                type="button"
                aria-label={t('net.zoomIn')}
                onClick={() => canvas.current?.zoomBy(1.25)}
              >
                <Plus aria-hidden />
              </button>
            </div>
            <div className="sn-grp sn-glass">
              <button type="button" aria-pressed={riskOnly} onClick={() => setRiskOnly((v) => !v)}>
                <TriangleAlert aria-hidden />
                {t('net.scamsOnly')}
              </button>
              <button type="button" aria-pressed={lensOn} onClick={() => setLensOn((v) => !v)}>
                <ScanSearch aria-hidden />
                {t('net.lens')}
              </button>
            </div>
          </div>
        </header>
        <span className="sn-note">
          <FlaskConical size={12} aria-hidden />
          {t('net.sample')}
        </span>

        <MonthScrubber
          months={months}
          month={month}
          onMonth={setMonth}
          activity={activity}
          label={t('net.months')}
          monthName={monthName}
        />

        <aside className="sn-legend sn-glass" aria-label={t('net.legend')}>
          <div className="h">{t('net.legend')}</div>
          <div className="sn-lg" style={{ cursor: 'default' }}>
            <span className="sn-sw" style={{ color: '#3de0ff' }}>
              <Shield size={14} />
            </span>
            <span className="t">{t('net.yourChecks')}</span>
            <span className="n">{net?.stats.checks ?? 0}</span>
          </div>
          {legendItems.map((it) => (
            <button
              key={it.k}
              type="button"
              className="sn-lg"
              aria-pressed={show[it.k]}
              onClick={() => setShow((s) => ({ ...s, [it.k]: !s[it.k] }))}
            >
              <span className="sn-sw">{it.sw}</span>
              <span className="t">{it.label}</span>
              <span className="n">{it.n}</span>
            </button>
          ))}
          <hr />
          <div className="sn-stt">
            <span>{t('net.blockedPct')}</span>
            <em style={{ color: '#ff6b84' }}>{net?.stats.blockedPct ?? 0}%</em>
          </div>
          <div className="sn-stt">
            <span>{t('net.mineIn')}</span>
            <em style={{ color: '#8beeff' }}>{net?.stats.mineInCampaigns ?? 0}</em>
          </div>
        </aside>

        <section className="sn-dock sn-glass" aria-label={t('net.dock')}>
          <dl className="sn-kp">
            <div>
              <dt>{t('net.kChecked')}</dt>
              <dd>{(net?.stats.checks ?? 0).toLocaleString('en-IN')}</dd>
            </div>
            <div>
              <dt>{t('net.kScams')}</dt>
              <dd className="r">{net?.stats.scams ?? 0}</dd>
            </div>
            <div>
              <dt>{t('net.kCampaigns')}</dt>
              <dd>{net?.stats.campaignsFound ?? 0}</dd>
            </div>
            <div>
              <dt>{t('net.kBlocked')}</dt>
              <dd>{net?.stats.blocked ?? 0}</dd>
            </div>
          </dl>
          <form className="sn-ask" onSubmit={ask} role="search">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('net.askPlaceholder')}
              aria-label={t('net.askLabel')}
            />
            <button type="submit" aria-label={t('net.askButton')}>
              <ArrowUp size={18} aria-hidden />
            </button>
          </form>
          {answer && (
            <p className="sn-ans" aria-live="polite">
              {answer.text} {answer.none && <Link to="/learn/ask">{t('net.askAkshi')}</Link>}
            </p>
          )}
          <div className="sn-chips">
            <span className="sn-ch">
              <FlaskConical size={13} aria-hidden />
              {t('net.sample')}
            </span>
            <button
              type="button"
              className="sn-ch"
              aria-pressed={sample.show}
              onClick={() => sample.setShow(!sample.show)}
            >
              <i />
              {t('net.sampleChecks')}
            </button>
          </div>
        </section>
      </section>

      {/* The same network as a list: the keyboard and screen-reader path to every node */}
      {net && (
        <details className="sn-list">
          <summary>
            <h2>{t('net.listTitle')}</h2>
          </summary>
          <p>{t('net.listBody')}</p>
          <ul aria-label={t('net.listTitle')}>
            {net.nodes
              .filter((n) => n.id !== CORE_ID)
              .map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    data-mine={n.mine || n.kind === 'mine' ? 'true' : undefined}
                    onClick={() => {
                      select(n.id);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  >
                    {n.kind === 'camp'
                      ? campaignName(n.key)
                      : n.kind === 'chan'
                        ? channelName(n.key)
                        : n.key}
                  </button>
                </li>
              ))}
          </ul>
        </details>
      )}
    </>
  );
}
