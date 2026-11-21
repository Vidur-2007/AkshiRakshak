import { ArrowRight, Play, X } from 'lucide-react';
import { m } from 'motion/react';
import { useEffect, useId, useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { LiveRiskMeter, useLiveScore } from '@/components/landing/LiveRiskMeter';
import { useScan } from '@/components/scan/useScan';
import { buttonVariants } from '@/components/ui/button';
import type { AnalysisResult } from '@/lib/engine';
import { useEngine } from '@/lib/engineLoader';
import { MAX_INPUT } from '@/lib/scan';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { RiseText } from './RiseText';

/** The bundled fake-KYC sample, analysed for real so the highlights and score are the engine's. */
const SAMPLE_ID = 'sample-fake-kyc';

interface Piece {
  text: string;
  flagged: boolean;
}

/** Split the sample into plain and flagged pieces using the engine's own spans. */
function pieces(text: string, result: AnalysisResult | null): Piece[] {
  if (!result) return [{ text, flagged: false }];
  const spans = result.signals
    .filter((s) => s.weight > 0)
    .flatMap((s) => s.spans)
    .sort((a, b) => a.start - b.start);
  const out: Piece[] = [];
  let pos = 0;
  for (const s of spans) {
    if (s.start < pos) continue;
    if (s.start > pos) out.push({ text: text.slice(pos, s.start), flagged: false });
    out.push({ text: text.slice(s.start, s.end), flagged: true });
    pos = s.end;
  }
  if (pos < text.length) out.push({ text: text.slice(pos), flagged: false });
  return out;
}

function Screen({
  dark,
  sample,
  result,
}: {
  dark: boolean;
  sample: string;
  result: AnalysisResult | null;
}) {
  const { t } = useTranslation();
  const firstSentence = result?.explanation.split(/(?<=[.!?।])\s/)[0] ?? '';
  return (
    <div className={cn('scr', dark ? 'd' : 'l')} aria-hidden>
      <div className="from">{t('home.smsFrom')}</div>
      <div className="chip">
        ● {result ? `${t(`verdict.${result.verdict}`)} · ${result.riskScore}/100` : '…'}
      </div>
      <div className="bub">
        {pieces(sample, dark ? result : null).map((p, i) =>
          p.flagged ? (
            <span key={i} className="f">
              {p.text}
            </span>
          ) : (
            <span key={i}>{p.text}</span>
          ),
        )}
      </div>
      <div className="time">{t('home.smsTime')}</div>
      <div className="verd">
        <b>{result ? t(`verdict.${result.verdict}`) : ''}</b>
        {firstSentence}
      </div>
      {dark && <div className="scanline" />}
    </div>
  );
}

function XrayToggle({ on, onToggle }: { on: boolean; onToggle(): void }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      className="xray-toggle inline-flex min-h-tap items-center gap-3 rounded-full px-2 text-sm font-medium outline-none focus-visible:outline-2 focus-visible:outline-brand"
      aria-pressed={on}
      aria-label={on ? t('home.toNormal') : t('home.toAkshi')}
      onClick={onToggle}
    >
      <span>{on ? t('home.akshi') : t('home.normal')}</span>
      <span
        aria-hidden
        className={cn(
          'relative block h-7 w-[3.25rem] rounded-full transition-colors duration-700',
          on ? 'bg-cyan' : 'bg-[#c8ced5]',
        )}
      >
        <span
          className={cn(
            'absolute top-1 left-1 size-5 rounded-full bg-white shadow-[0_2px_6px_rgb(0_0_0/0.3)] transition-transform duration-700',
            on && 'translate-x-6',
          )}
        />
      </span>
    </button>
  );
}

/**
 * Akshi view callouts around the phone (the design's annotations): what each marked phrase of the
 * sample means. Positions are in the stage's container units, so they track the phone.
 */
function Callouts() {
  const { t } = useTranslation();
  return (
    <div className="ann" aria-hidden>
      <svg viewBox="0 0 179.09 100" preserveAspectRatio="none">
        <line x1="68" y1="64" x2="80.5" y2="65" />
        <circle cx="80.5" cy="65" r=".45" />
        <line x1="68" y1="73" x2="81" y2="71.5" />
        <circle cx="81" cy="71.5" r=".45" />
        <line x1="111" y1="67" x2="98.5" y2="67.5" />
        <circle cx="98.5" cy="67.5" r=".45" />
        <line x1="111" y1="76" x2="96" y2="74.5" />
        <circle cx="96" cy="74.5" r=".45" />
      </svg>
      <div className="cl l" style={{ left: '67.4cqh', top: '64cqh' }}>
        <b>{t('home.ann1')}</b>
        <span>{t('home.ann1Sub')}</span>
      </div>
      <div className="cl l" style={{ left: '67.4cqh', top: '73cqh' }}>
        <b>{t('home.ann2')}</b>
        <span>{t('home.ann2Sub')}</span>
      </div>
      <div className="cl" style={{ left: '111.6cqh', top: '67cqh' }}>
        <b>{t('home.ann3')}</b>
        <span>{t('home.ann3Sub')}</span>
      </div>
      <div className="cl" style={{ left: '111.6cqh', top: '76cqh' }}>
        <b>{t('home.ann4')}</b>
        <span>{t('home.ann4Sub')}</span>
      </div>
    </div>
  );
}

/** "Check a message": the real paste box with the live meter; the card morphs into the result. */
function CheckPanel({ onClose }: { onClose(): void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const inputId = useId();
  const [text, setText] = useState('');
  const live = useLiveScore(text);
  const { run, busy } = useScan();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) {
      navigate('/scan');
      return;
    }
    void run(text);
  };
  return (
    <form onSubmit={submit} className="check-panel">
      <m.div layoutId="scan-card" className="glass relative rounded-sheet p-4 text-text">
        <button
          type="button"
          onClick={onClose}
          aria-label={t('home.closeCheck')}
          className="absolute top-2 right-2 inline-flex size-9 items-center justify-center rounded-full text-text-2 hover:bg-overlay/6 hover:text-text"
        >
          <X className="size-4" aria-hidden />
        </button>
        <label htmlFor={inputId} className="text-sm font-medium">
          {t('landing.inputLabel')}
        </label>
        <textarea
          id={inputId}
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MAX_INPUT))}
          rows={3}
          placeholder={t('landing.inputPlaceholder')}
          className="mt-2 w-full resize-none rounded-card border border-glass-border bg-surface-2 p-3 text-base text-text outline-none placeholder:text-text-2/70 focus-visible:border-brand"
        />
        <div className="mt-3">
          <LiveRiskMeter live={live} />
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="submit" disabled={busy} className={buttonVariants({ size: 'lg' })}>
            {t('placeholder.scanNow')}
            <ArrowRight aria-hidden />
          </button>
        </div>
      </m.div>
    </form>
  );
}

/** Moment 1: the same SMS seen normally, then through Akshi's eye. */
export function HeroXray({
  id,
  children,
  onXrayChange,
}: {
  id: string;
  children?: ReactNode;
  onXrayChange?: (on: boolean) => void;
}) {
  const { t } = useTranslation();
  const lang = useAppStore((s) => s.lang);
  const engine = useEngine();
  const [xray, setXray] = useState(false);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const sample = engine?.SAMPLE_MESSAGES.find((s) => s.id === SAMPLE_ID);

  useEffect(() => {
    if (!engine || !sample) return;
    let alive = true;
    void engine
      .analyze({
        kind: 'message',
        text: sample.text,
        lang,
        options: { expandLinks: false, domainAge: false },
      })
      .then((r) => alive && setResult(r))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [engine, sample, lang]);

  return (
    <section
      id={id}
      aria-labelledby="hero-title"
      className="moment hero"
      data-xray={xray ? 'on' : 'off'}
      data-checking={checking ? 'on' : 'off'}
    >
      <div className="moment-frame">
        <div className="bg-day" />
        <div className="bg-night" />
        <div className="stage">
          <div className="giant" aria-hidden>
            Rak<em>shak</em>
          </div>
          <div className="glow" />
          {sample && (
            <div className="phone" role="img" aria-label={t('home.phoneLabel')}>
              <Screen dark={false} sample={sample.text} result={result} />
              <Screen dark sample={sample.text} result={result} />
            </div>
          )}
          <Callouts />
        </div>
      </div>

      <XrayToggle
        on={xray}
        onToggle={() => {
          setXray(!xray);
          onXrayChange?.(!xray);
        }}
      />

      <div className="copy">
        <div className="eyebrow enter-rise">{t('home.eyebrow')}</div>
        <h1 id="hero-title">
          <RiseText
            lines={[
              [{ t: t('home.h1a') }],
              [{ t: `${t('home.h1b')} ` }, { t: t('home.h1bEm'), em: true }],
            ]}
            lineClassName={['a', 'b']}
          />
        </h1>
        <p className="sub enter-rise">{t('home.sub')}</p>
        {checking ? (
          <CheckPanel onClose={() => setChecking(false)} />
        ) : (
          <div className="enter-rise flex flex-wrap justify-center gap-3">
            <a href="#home-how" className={buttonVariants({ variant: 'outline', size: 'lg' })}>
              {t('home.how')}
            </a>
            <button
              type="button"
              onClick={() => setChecking(true)}
              className={buttonVariants({ size: 'lg' })}
            >
              {t('home.check')}
            </button>
          </div>
        )}
      </div>

      <div className="foot">
        <span className="note self-center">{t('home.heroFoot')}</span>
        <Link
          to="/tour?start=1"
          className="ml-auto inline-flex min-h-tap items-center gap-2 rounded-full px-3 underline-offset-4 hover:underline"
        >
          <Play className="size-4" aria-hidden />
          {t('landing.tour')}
        </Link>
      </div>
      {children}
    </section>
  );
}
