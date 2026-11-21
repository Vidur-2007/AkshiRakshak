import '@/styles/network.css';
import { Maximize2, Minus, Plus, Search, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router';
import {
  drawCard,
  TaxonomyCanvas,
  type CardLabels,
  type HoverItem,
  type TaxonomyHandle,
} from '@/components/network/TaxonomyCanvas';
import { usePageTitle } from '@/hooks/usePageTitle';
import type { CampaignSamplesData } from '@/lib/campaignMatch';
import {
  analyze,
  categoryText,
  loadCampaignSamples,
  type AnalysisResult,
  type Lang,
} from '@/lib/engine';
import { useAppStore } from '@/lib/store';
import { buildTaxonomy, LEVERS, type LeverId, type TaxMessage, type TaxNode } from '@/lib/taxonomy';

const REPORT_URL = 'https://cybercrime.gov.in';
const LANG_NAME: Record<string, string> = {
  en: 'English',
  hi: 'हिंदी',
  te: 'తెలుగు',
  bn: 'বাংলা',
};

export function canvasSupported(): boolean {
  try {
    return !!document.createElement('canvas').getContext('2d');
  } catch {
    return false;
  }
}

/** The detail panel for one sample message: what Akshi's engine finds in it, and how to spot it. */
function Detail({
  m,
  lang,
  labels,
  onClose,
}: {
  m: TaxMessage;
  lang: Lang;
  labels: CardLabels;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const big = useRef<HTMLCanvasElement>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  useEffect(() => {
    if (big.current) drawCard(big.current, m, labels);
  }, [m, labels]);
  useEffect(() => {
    let live = true;
    setResult(null);
    // on-device only: no AI, link expansion or domain lookup for the synthetic samples
    analyze({
      kind: 'message',
      text: m.text,
      lang,
      options: { cloudAI: false, expandLinks: false, domainAge: false },
    })
      .then((r) => {
        if (live) setResult(r);
      })
      .catch(() => {
        /* the panel keeps "Checking…"; the check page still works */
      });
    return () => {
      live = false;
    };
  }, [m, lang]);

  const lever = LEVERS.find((l) => l.id === m.lever)!;
  const kind = categoryText(m.category, lang).name;
  const found = (result?.signals ?? [])
    .filter((s) => s.weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 4);
  return (
    <>
      <button type="button" className="tx-x" onClick={onClose} aria-label={t('tax.close')}>
        <X size={16} aria-hidden />
      </button>
      <div className="crumb">
        <span style={{ color: lever.color }}>{t(`tax.lever.${m.lever}.name`)}</span>
        <i aria-hidden>→</i>
        <span>{kind}</span>
        <i aria-hidden>→</i>
        <span>{t(`tax.chan.${m.channel}`, { defaultValue: m.channel })}</span>
      </div>
      <h2>{kind}</h2>
      <canvas ref={big} aria-hidden />
      <p className="say" lang={m.lang}>
        “{m.text}”
        <small lang={lang}>
          {t('tax.sampleFrom')} · {LANG_NAME[m.lang] ?? m.lang}
        </small>
      </p>
      <div className="tx-verdict" data-v={result?.verdict ?? 'checking'} aria-live="polite">
        <b>{result ? t(`verdict.${result.verdict}`) : t('tax.checking')}</b>
        {result && <span>{t('tax.verdictLine', { risk: result.riskScore })}</span>}
      </div>
      {result && (
        <div>
          <h3>{t('tax.found')}</h3>
          {found.length ? (
            <ul>
              {found.map((s) => (
                <li key={s.id}>
                  {s.label}
                  {/* a bundled-indicator match keeps its "(sample data)" note (truth rules) */}
                  {s.id === 'KNOWN_INDICATOR' && s.detail ? `: ${s.detail}` : ''}
                </li>
              ))}
            </ul>
          ) : (
            <p className="say">{t('tax.noneFound')}</p>
          )}
        </div>
      )}
      <div>
        <h3>{t('tax.spot')}</h3>
        <ul>
          <li>{t(`tax.lever.${m.lever}.tip1`)}</li>
          <li>{t(`tax.lever.${m.lever}.tip2`)}</li>
        </ul>
      </div>
      <div className="tx-acts">
        <button
          type="button"
          className="p"
          onClick={() => void navigate('/scan', { state: { prefill: m.text } })}
        >
          {t('tax.checkLike')}
        </button>
        <a href={REPORT_URL} target="_blank" rel="noreferrer">
          {t('tax.report')} ↗
        </a>
      </div>
    </>
  );
}

/** The Network page: a taxonomy of scams (design "Scam taxonomy · Network V3", 2026-11-21). */
export default function NetworkPage() {
  const { t } = useTranslation();
  usePageTitle(t('page.network.title'));
  const lang = useAppStore((s) => s.lang);
  const [data, setData] = useState<CampaignSamplesData | null>(null);
  const [canvasOk] = useState(canvasSupported);
  useEffect(() => {
    void loadCampaignSamples()
      .then(setData)
      .catch(() => {
        /* offline before the data was cached: the page shows the title and the list stays empty */
      });
  }, []);

  // the top bar goes dark over the wall
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('nav-night');
    return () => root.classList.remove('nav-night');
  }, []);

  const tax = useMemo(() => (data ? buildTaxonomy(data, lang) : null), [data, lang]);
  const [on, setOn] = useState<Record<LeverId, boolean>>({
    fear: true,
    trust: true,
    greed: true,
    urgency: true,
  });
  const [interacted, setInteracted] = useState(false);
  const [hover, setHover] = useState<HoverItem | null>(null);
  const [selected, setSelected] = useState<TaxMessage | null>(null);
  const [query, setQuery] = useState('');
  const [focus, setFocus] = useState<string | null>(null);
  const canvas = useRef<TaxonomyHandle>(null);
  // "A taxonomy of {{em}}": the red word can sit anywhere in the sentence, depending on the language
  const titleParts = t('tax.title', { em: '\u0000' }).split('\u0000');
  const interact = useCallback(() => setInteracted(true), []);

  const labels: CardLabels = useMemo(
    () => ({
      sms: t('tax.card.sms'),
      whatsapp: t('tax.card.whatsapp'),
      telegram: t('tax.card.telegram'),
      call: t('tax.card.call'),
      email: t('tax.card.email'),
      upi: t('tax.card.upi'),
      pay: t('tax.card.pay'),
      decline: t('tax.card.decline'),
      qr: t('tax.card.qr'),
      sample: t('tax.card.sample'),
    }),
    [t],
  );
  const leverName = useCallback((id: LeverId) => t(`tax.lever.${id}.name`), [t]);
  const nodeName = useCallback(
    (n: TaxNode) =>
      n.kind === 'lever'
        ? leverName(n.lever)
        : n.kind === 'tactic'
          ? categoryText(n.category!, lang).name
          : t(`tax.chan.${n.channel}`, { defaultValue: n.channel ?? '' }),
    [lang, leverName, t],
  );
  const names = useMemo(() => ({ lever: leverName, node: nodeName }), [leverName, nodeName]);

  // Campaign Match's "See it on the network": /network?category=<kind> lights up that kind
  const [params] = useSearchParams();
  const wanted = params.get('category');
  useEffect(() => {
    if (!tax || !wanted) return;
    const id = `tactic:${wanted}`;
    if (!tax.nodes.some((n) => n.id === id)) return;
    setInteracted(true);
    setFocus(id);
  }, [tax, wanted]);

  // search: messages whose text, kind or channel matches
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!tax || q.length < 2) return null;
    return new Set(
      tax.messages
        .filter(
          (m) =>
            m.text.toLowerCase().includes(q) ||
            categoryText(m.category, lang).name.toLowerCase().includes(q) ||
            t(`tax.chan.${m.channel}`).toLowerCase().includes(q),
        )
        .map((m) => m.id),
    );
  }, [tax, query, lang, t]);
  useEffect(() => {
    if (!matches || !tax) return;
    const first = tax.messages.find((m) => matches.has(m.id));
    if (first) canvas.current?.flyTo(first.id);
  }, [matches, tax]);

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelected(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected]);

  const caption = (() => {
    if (!tax) return null;
    if (hover && 'node' in hover) {
      const n = hover.node;
      const L = LEVERS.find((l) => l.id === n.lever)!;
      if (n.kind === 'lever')
        return (
          <>
            <b style={{ color: L.color }}>{leverName(n.lever)}.</b> {t(`tax.lever.${n.lever}.line`)}
          </>
        );
      if (n.kind === 'tactic')
        return (
          <>
            <b>{nodeName(n)}</b> · {t('tax.capTactic', { lever: leverName(n.lever) })}{' '}
            {t(`tax.lever.${n.lever}.line`)}
          </>
        );
      return (
        <>
          <b>{nodeName(n)}</b> · {categoryText(n.category!, lang).name} · {leverName(n.lever)}
        </>
      );
    }
    if (hover && 'message' in hover) {
      const m = hover.message;
      return (
        <>
          <b>{t(`tax.chan.${m.channel}`)}</b> · {categoryText(m.category, lang).name} ·{' '}
          {leverName(m.lever)}. {t('tax.openHint')}
        </>
      );
    }
    const n = tax.messages.filter((m) => on[m.lever]).length;
    const levers = LEVERS.filter((l) => on[l.id]).length;
    return <>{t('tax.capDefault', { n, levers })}</>;
  })();

  const byLever = useMemo(
    () =>
      LEVERS.map((L) => ({
        L,
        kinds: L.categories.map((c) => ({
          c,
          msgs: (tax?.messages ?? []).filter((m) => m.category === c),
        })),
      })),
    [tax],
  );

  return (
    <>
      <section className="tx-app" aria-labelledby="page-title">
        {tax && canvasOk && (
          <TaxonomyCanvas
            ref={canvas}
            tax={tax}
            on={on}
            matches={matches}
            focus={focus}
            selected={selected?.id ?? null}
            onHover={setHover}
            onPick={setSelected}
            onInteract={interact}
            names={names}
            labels={labels}
            ariaLabel={t('tax.canvas')}
            panelOpen={!!selected}
            flyToId={focus}
          />
        )}

        <header className="tx-top">
          <nav className="tx-levers tx-panel" aria-label={t('tax.leversLabel')}>
            {LEVERS.map((L) => (
              <button
                key={L.id}
                type="button"
                className="tx-lv"
                aria-pressed={on[L.id]}
                style={{ ['--c' as string]: L.color }}
                onClick={() => {
                  interact();
                  setOn((o) => ({ ...o, [L.id]: !o[L.id] }));
                }}
              >
                <i aria-hidden />
                {leverName(L.id)}
              </button>
            ))}
          </nav>
          <label className="tx-search tx-panel">
            <Search size={16} aria-hidden />
            <input
              value={query}
              onChange={(e) => {
                interact();
                setQuery(e.target.value);
              }}
              placeholder={t('tax.searchPlaceholder')}
              aria-label={t('tax.searchLabel')}
            />
          </label>
          <Link to="/scan" className="tx-cta">
            {t('tax.check')}
          </Link>
        </header>

        <div className="tx-title" data-off={interacted}>
          <h1 id="page-title">
            {titleParts[0]}
            <em>{t('tax.titleEm')}</em>
            {titleParts[1]}
          </h1>
          <p>
            {t('tax.intro')} <span className="tx-hover">{t('tax.introHover')}</span>
            <span className="tx-touch">{t('tax.introTouch')}</span>
          </p>
        </div>

        <p className="tx-cap tx-panel" aria-live="polite">
          {caption}
        </p>
        <div className="tx-zoom tx-panel">
          <button
            type="button"
            aria-label={t('tax.zoomOut')}
            onClick={() => canvas.current?.zoomBy(1 / 1.3)}
          >
            <Minus size={18} aria-hidden />
          </button>
          <button
            type="button"
            aria-label={t('tax.zoomIn')}
            onClick={() => {
              interact();
              canvas.current?.zoomBy(1.3);
            }}
          >
            <Plus size={18} aria-hidden />
          </button>
          <button
            type="button"
            aria-label={t('tax.fit')}
            onClick={() => {
              setSelected(null);
              setFocus(null);
              canvas.current?.fit();
            }}
          >
            <Maximize2 size={16} aria-hidden />
          </button>
        </div>
        <span className="tx-note">{t('tax.note')}</span>

        <aside
          className="tx-det tx-panel"
          data-on={!!selected}
          aria-label={t('tax.details')}
          aria-hidden={!selected}
        >
          {selected && (
            <Detail m={selected} lang={lang} labels={labels} onClose={() => setSelected(null)} />
          )}
        </aside>
      </section>

      {/* The same wall as a list: the keyboard and screen-reader path to every message */}
      {tax && (
        <details className="tx-list">
          <summary>
            <h2>{t('tax.listTitle')}</h2>
          </summary>
          <p>{t('tax.listBody')}</p>
          {byLever.map(({ L, kinds }) => (
            <section key={L.id} aria-label={leverName(L.id)}>
              {kinds.map(({ c, msgs }) =>
                msgs.length ? (
                  <div key={c}>
                    <h3>
                      <span style={{ color: L.color }}>{leverName(L.id)}</span> ·{' '}
                      {categoryText(c, lang).name}
                    </h3>
                    <ul>
                      {msgs.map((m) => (
                        <li key={m.id}>
                          <button
                            type="button"
                            lang={m.lang}
                            onClick={() => {
                              interact();
                              setSelected(m);
                              canvas.current?.flyTo(m.id);
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                          >
                            {t(`tax.chan.${m.channel}`)} ·{' '}
                            {m.text.length > 70 ? `${m.text.slice(0, 69)}…` : m.text}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null,
              )}
            </section>
          ))}
        </details>
      )}
    </>
  );
}
