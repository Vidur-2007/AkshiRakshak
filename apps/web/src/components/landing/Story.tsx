/**
 * Landing scroll story (§5.1, M12.2): seven sections. Each animation runs once when
 * it comes into view; only ShieldCore loops. Reduced motion shows final states.
 */
import { ExternalLink, FlaskConical, Phone, Plane, ScanLine, Siren } from 'lucide-react';
import {
  AnimatePresence,
  m,
  useInView,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
  type MotionValue,
} from 'motion/react';
import { useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { RevealProvider, useCountUp } from '@/components/analysis/reveal';
import { PinPadExplainer } from '@/components/modules/PinPadExplainer';
import { MODULES } from '@/components/shell/nav';
import { buttonVariants } from '@/components/ui/button';
import { TIER_SETTINGS } from '@/lib/deviceTier';
import {
  analyze,
  EVAL_REPORT,
  SAMPLE_MESSAGES,
  scoreLive,
  type Lang,
  type Signal,
} from '@/lib/engine';
import i18n, { loadAllLanguages } from '@/lib/i18n';
import { UI_LANGS } from '@/lib/langs';
import { transition } from '@/lib/motion';
import { isPlaceholderReport, pct } from '@/lib/proof';
import { clampScore, TONE_COLOR } from '@/lib/risk';
import { buildSegments, rangeTone } from '@/lib/spans';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';

/** Public source repository (SPEC.md §5.1 footer). */
export const REPO_URL = 'https://github.com/Vidur-2007/AkshiRakshak';

function SectionTitle({ title, body }: { title: string; body?: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h2>
      {body && <p className="mt-3 text-text-2">{body}</p>}
    </div>
  );
}

const FAKE_KYC = SAMPLE_MESSAGES.find((s) => s.id === 'sample-fake-kyc') ?? SAMPLE_MESSAGES[0];

/** 1. Anatomy of a scam: the SMS stays pinned while its red-flag phrases lift off. */
function Anatomy() {
  const { t } = useTranslation();
  const lang = useAppStore((s) => s.lang);
  const reduced = useReducedMotion() ?? false;
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  const [step, setStep] = useState(reduced ? 99 : 0);
  const [signals, setSignals] = useState<Signal[]>([]);
  const text = FAKE_KYC?.text ?? '';

  // Real phrases from the engine, strongest four
  useEffect(() => {
    if (!text) return;
    void analyze({ kind: 'message', text, lang }).then((r) =>
      setSignals(r.signals.filter((s) => s.weight > 0 && s.spans.length).slice(0, 4)),
    );
  }, [text, lang]);

  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    if (!reduced) setStep(Math.floor(v * 5));
  });

  const segments = useMemo(() => buildSegments(normalize(text), signals), [text, signals]);

  return (
    <section ref={ref} aria-labelledby="story-anatomy" className="relative h-[220vh]">
      <div className="sticky top-[calc(var(--topbar-h)+2rem)] mx-auto flex max-w-3xl flex-col gap-8 px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 id="story-anatomy" className="text-xl font-semibold tracking-tight sm:text-2xl">
            {t('story.anatomyTitle')}
          </h2>
          <p className="mt-3 text-text-2">{t('story.anatomyBody')}</p>
        </div>
        <div className="surface relative mx-auto w-full max-w-xl p-5 sm:p-6">
          <span className="mb-3 inline-flex items-center gap-1 rounded-full border border-glass-border px-2 py-0.5 text-xs text-text-2">
            <FlaskConical className="size-3" aria-hidden />
            {t('placeholder.sampleData')}
          </span>
          <p className="text-lg leading-[2.4] break-words" lang={FAKE_KYC?.lang}>
            {segments.map((seg) => {
              if (seg.kind === 'plain') return <span key={seg.start}>{seg.text}</span>;
              const lifted = seg.range.rank < step;
              const color = TONE_COLOR[rangeTone(seg.range)];
              return (
                <m.span
                  key={seg.start}
                  className="relative inline rounded-[4px] px-0.5"
                  animate={
                    lifted
                      ? { y: -6, backgroundColor: `color-mix(in srgb, ${color} 22%, transparent)` }
                      : { y: 0, backgroundColor: 'rgba(0,0,0,0)' }
                  }
                  transition={transition.base}
                >
                  {seg.text}
                  <AnimatePresence>
                    {lifted && (
                      <m.span
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="pointer-events-none absolute -top-6 left-0 rounded-full px-2 py-0.5 text-[0.7rem] leading-none font-semibold whitespace-nowrap text-bg"
                        style={{ background: color }}
                      >
                        {seg.range.signals[0]?.label}
                      </m.span>
                    )}
                  </AnimatePresence>
                </m.span>
              );
            })}
          </p>
        </div>
      </div>
    </section>
  );
}

function normalize(s: string) {
  return s.replace(/\s+/g, ' ').trim();
}

/** 2. The PIN rule: the explainer plays once when it scrolls into view. */
function PinRule() {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  return (
    <section aria-labelledby="story-pin" className="mx-auto max-w-3xl px-4 py-24 sm:px-6">
      <div className="text-center">
        <h2 id="story-pin" className="text-xl font-semibold tracking-tight sm:text-2xl">
          {t('story.pinTitle')}
        </h2>
        <p className="mt-3 text-2xl leading-snug font-semibold text-balance sm:text-[2rem]">
          {t('story.pinCaption')}
        </p>
      </div>
      <div ref={ref} className="surface mx-auto mt-8 max-w-md p-5">
        <RevealProvider>
          {inView ? <PinPadExplainer amount={4999} /> : <div className="h-96" />}
        </RevealProvider>
      </div>
    </section>
  );
}

/** Card that tilts toward the cursor on desktop, high tier only (§3.4). */
function TiltCard({ children, to }: { children: ReactNode; to: string }) {
  const tier = useAppStore((s) => s.deviceTier);
  const reduced = useReducedMotion() ?? false;
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const srx = useSpring(rx, { stiffness: 200, damping: 20 }) as MotionValue<number>;
  const sry = useSpring(ry, { stiffness: 200, damping: 20 }) as MotionValue<number>;
  const tilt = TIER_SETTINGS[tier].tilt && !reduced;
  const onMove = (e: PointerEvent<HTMLAnchorElement>) => {
    if (!tilt || e.pointerType !== 'mouse') return;
    const r = e.currentTarget.getBoundingClientRect();
    ry.set(((e.clientX - r.left) / r.width - 0.5) * 10);
    rx.set(-((e.clientY - r.top) / r.height - 0.5) * 10);
  };
  return (
    <m.div style={tilt ? { rotateX: srx, rotateY: sry, transformPerspective: 800 } : undefined}>
      <Link
        to={to}
        onPointerMove={onMove}
        onPointerLeave={() => {
          rx.set(0);
          ry.set(0);
        }}
        className="surface flex h-full flex-col gap-2 p-5 transition-colors hover:border-brand/40 outline-none focus-visible:outline-2 focus-visible:outline-brand"
      >
        {children}
      </Link>
    </m.div>
  );
}

/** 3. Modules: six cards. */
function Modules() {
  const { t } = useTranslation();
  const card = (key: string) => {
    const item = MODULES.find((m1) => m1.key === key)!;
    return {
      to: item.to,
      icon: item.icon,
      title: t(`nav.${item.key}`),
      body: t(`navDesc.${item.descKey ?? item.key}`),
    };
  };
  // Messages, Screenshots, Collect requests, QR & links, Transactions, Emergency (§5.1)
  const cards = [
    card('messages'),
    {
      to: '/scan',
      icon: ScanLine,
      title: t('story.modScreenshots'),
      body: t('story.modScreenshotsDesc'),
    },
    card('collect'),
    card('qrLink'),
    card('transactions'),
    { to: '/sos', icon: Siren, title: t('nav.sos'), body: t('story.modEmergencyDesc') },
  ];
  return (
    <section aria-labelledby="story-modules" className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
      <SectionTitle title={t('story.modulesTitle')} />
      <ul className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <li key={c.to + c.title}>
            <TiltCard to={c.to}>
              <c.icon className="size-6 text-brand" aria-hidden />
              <span className="text-lg font-semibold">{c.title}</span>
              <span className="text-sm text-text-2">{c.body}</span>
            </TiltCard>
          </li>
        ))}
      </ul>
    </section>
  );
}

function CountPct({ value, delayMs }: { value: number; delayMs: number }) {
  const n = useCountUp(Math.round(value * 1000), delayMs, 1100);
  return <>{pct(n / 1000)}</>;
}

/** 4. Proof: three numbers from EVAL_REPORT count up in view. */
function Proof() {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const placeholder = isPlaceholderReport(EVAL_REPORT);
  const metrics = [
    { label: t('story.proofPrecision'), value: EVAL_REPORT.overall.precision },
    { label: t('story.proofRecall'), value: EVAL_REPORT.overall.recall },
    { label: t('story.proofFpr'), value: EVAL_REPORT.fprGenuineBank },
  ];
  return (
    <section aria-labelledby="story-proof" className="mx-auto max-w-4xl px-4 py-24 sm:px-6">
      <div className="text-center">
        <h2 id="story-proof" className="text-xl font-semibold tracking-tight sm:text-2xl">
          {t('story.proofTitle')}
        </h2>
        {placeholder && (
          <p className="mx-auto mt-3 inline-flex max-w-xl items-start gap-2 rounded-chip border border-risk-warn/40 bg-risk-warn/10 px-3 py-2 text-left text-sm">
            <FlaskConical className="mt-0.5 size-4 shrink-0 text-risk-warn" aria-hidden />
            <span>
              <strong>
                {t('placeholder.sampleData')} · {t('proof.placeholderTitle')}.
              </strong>{' '}
              {t('proof.placeholderBody')}
            </span>
          </p>
        )}
      </div>
      <div ref={ref} className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <RevealProvider>
          {metrics.map((mt, i) => (
            <div key={mt.label} className="surface p-6 text-center">
              <p className="font-mono text-[2.5rem] leading-none font-semibold tabular-nums">
                {inView ? <CountPct value={mt.value} delayMs={i * 150} /> : '0%'}
              </p>
              <p className="mt-2 text-sm text-text-2">{mt.label}</p>
            </div>
          ))}
        </RevealProvider>
      </div>
      <div className="mt-6 text-center">
        <Link to="/proof" className={buttonVariants({ variant: 'outline' })}>
          {t('story.proofLink')}
        </Link>
      </div>
    </section>
  );
}

/** 5. Works offline: the airplane toggle switches on and a real local check still runs. */
function Offline() {
  const { t } = useTranslation();
  const lang = useAppStore((s) => s.lang);
  const reduced = useReducedMotion() ?? false;
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const [on, setOn] = useState(reduced);
  const [score, setScore] = useState<number | null>(null);
  useEffect(() => {
    if (!inView) return;
    const run = () => setScore(clampScore(scoreLive(FAKE_KYC?.text ?? '', lang).riskScore));
    if (reduced) {
      setOn(true);
      run();
      return;
    }
    const a = window.setTimeout(() => setOn(true), 500);
    const b = window.setTimeout(run, 1100);
    return () => {
      window.clearTimeout(a);
      window.clearTimeout(b);
    };
  }, [inView, reduced, lang]);
  return (
    <section aria-labelledby="story-offline" className="mx-auto max-w-3xl px-4 py-24 sm:px-6">
      <div className="text-center">
        <h2 id="story-offline" className="text-xl font-semibold tracking-tight sm:text-2xl">
          {t('story.offlineTitle')}
        </h2>
        <p className="mt-3 text-text-2">{t('story.offlineBody')}</p>
      </div>
      <div ref={ref} className="surface mx-auto mt-8 flex max-w-md flex-col items-center gap-5 p-6">
        <div className="flex items-center gap-3" aria-hidden>
          <Plane className={cn('size-6 transition-colors', on ? 'text-brand' : 'text-text-2')} />
          <span className="text-sm">{t('story.airplane')}</span>
          <span
            className={cn(
              'flex h-6 w-11 items-center rounded-full border p-0.5 transition-colors duration-300',
              on ? 'border-brand/60 bg-brand/25' : 'border-glass-border bg-surface-2',
            )}
          >
            <span
              className={cn(
                'block size-4.5 rounded-full transition-transform duration-300',
                on ? 'translate-x-5 bg-brand' : 'bg-text-2',
              )}
            />
          </span>
        </div>
        <p className="min-h-6 text-center text-sm" aria-live="polite">
          {score !== null && t('story.offlineResult', { score })}
        </p>
      </div>
    </section>
  );
}

/** 6. Four languages: the same warning morphs through en, hi, te and bn once, then stays. */
function Languages() {
  const { t } = useTranslation();
  const uiLang = useAppStore((s) => s.lang);
  const reduced = useReducedMotion() ?? false;
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const [shown, setShown] = useState<Lang>(uiLang);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!inView) return;
    let cancelled = false;
    void loadAllLanguages().then(() => {
      if (cancelled) return;
      setReady(true);
      if (reduced) return;
      UI_LANGS.forEach((l, i) =>
        window.setTimeout(() => !cancelled && setShown(l), 300 + i * 1500),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [inView, reduced]);
  const text = ready ? i18n.t('story.warning', { lng: shown }) : t('story.warning');
  return (
    <section aria-labelledby="story-langs" className="mx-auto max-w-3xl px-4 py-24 sm:px-6">
      <SectionTitle title={t('story.langTitle')} body={t('story.langBody')} />
      <div
        ref={ref}
        className="surface mx-auto mt-8 flex min-h-48 max-w-xl flex-col items-center justify-center gap-5 p-6"
      >
        <AnimatePresence mode="wait">
          <m.p
            key={shown}
            lang={shown}
            initial={{ opacity: 0, filter: 'blur(6px)' }}
            animate={{ opacity: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, filter: 'blur(6px)' }}
            transition={transition.slow}
            className="text-center text-2xl leading-snug font-semibold text-balance"
          >
            {text}
          </m.p>
        </AnimatePresence>
        <div
          role="radiogroup"
          aria-label={t('shell.language')}
          className="flex flex-wrap justify-center gap-1"
        >
          {UI_LANGS.map((l) => (
            <button
              key={l}
              type="button"
              role="radio"
              aria-checked={shown === l}
              lang={l}
              onClick={() => {
                void loadAllLanguages().then(() => setReady(true));
                setShown(l);
              }}
              className={cn(
                'min-h-9 rounded-chip px-3 text-sm outline-none focus-visible:outline-2 focus-visible:outline-brand',
                shown === l ? 'bg-brand/15 text-brand' : 'text-text-2 hover:text-text',
              )}
            >
              {t(`lang.${l}`)}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

/** 7. Call to action and footer with 1930, cybercrime.gov.in and Chakshu. */
function CtaFooter() {
  const { t } = useTranslation();
  const ext = { target: '_blank', rel: 'noopener noreferrer' } as const;
  return (
    <>
      <section
        aria-labelledby="story-cta"
        className="mx-auto max-w-3xl px-4 py-24 text-center sm:px-6"
      >
        <h2 id="story-cta" className="text-2xl font-semibold tracking-tight sm:text-[2.5rem]">
          {t('story.ctaTitle')}
        </h2>
        <Link to="/scan" className={buttonVariants({ size: 'lg', className: 'mt-6' })}>
          <ScanLine aria-hidden />
          {t('placeholder.scanNow')}
        </Link>
      </section>
      <footer className="border-t border-glass-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex flex-col gap-2">
            <p className="font-medium">{t('story.footerHelp')}</p>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              <a
                href="tel:1930"
                className="inline-flex items-center gap-1.5 text-text hover:text-brand"
              >
                <Phone className="size-4 text-risk-scam" aria-hidden />
                {t('story.footer1930')}
              </a>
              <a
                href="https://cybercrime.gov.in"
                {...ext}
                className="inline-flex items-center gap-1.5 text-text hover:text-brand"
              >
                cybercrime.gov.in
                <ExternalLink className="size-3.5" aria-hidden />
              </a>
              <a
                href="https://sancharsaathi.gov.in/sfc/"
                {...ext}
                className="inline-flex items-center gap-1.5 text-text hover:text-brand"
              >
                {t('story.footerChakshu')}
                <ExternalLink className="size-3.5" aria-hidden />
              </a>
            </div>
          </div>
          <div className="flex flex-col gap-2 text-text-2 sm:items-end">
            <a
              href={REPO_URL}
              {...ext}
              className="inline-flex items-center gap-1.5 hover:text-text"
            >
              {t('story.footerGithub')}
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
            <span>{t('story.footerBuilt')}</span>
          </div>
        </div>
      </footer>
    </>
  );
}

export function Story() {
  return (
    <>
      <Anatomy />
      <PinRule />
      <Modules />
      <Proof />
      <Offline />
      <Languages />
      <CtaFooter />
    </>
  );
}
