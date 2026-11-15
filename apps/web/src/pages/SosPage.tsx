import { ArrowLeft, Check, ExternalLink, FileText, Phone, RotateCcw, X } from 'lucide-react';
import { AnimatePresence, m } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { buttonVariants } from '@/components/ui/button';
import { usePageTitle } from '@/hooks/usePageTitle';
import { allScans, type ScanRecord } from '@/lib/db';
import {
  actionHref,
  buildChecklist,
  saveDraft,
  type Answers,
  type QuestionId,
  type ReportDraft,
} from '@/lib/emergency';
import { EMERGENCY, type EmergencyStep } from '@/lib/engine';
import { l10n } from '@/lib/l10n';
import { transition } from '@/lib/motion';
import { VERDICT_ICON } from '@/lib/risk';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';

const QUESTIONS = EMERGENCY.questions;

function StepAction({ step }: { step: EmergencyStep }) {
  const lang = useAppStore((s) => s.lang);
  const a = step.action;
  if (!a) return null;
  const href = actionHref(a);
  const label = l10n(a.label, lang);
  if (a.kind === 'internal') {
    return (
      <Link to={href} className={buttonVariants({ variant: 'outline', className: 'mt-3' })}>
        {label}
      </Link>
    );
  }
  const tel = a.kind === 'tel';
  return (
    <a
      href={href}
      {...(tel ? {} : { target: '_blank', rel: 'noopener noreferrer' })}
      className={buttonVariants({
        variant: tel ? 'danger' : 'outline',
        size: tel ? 'lg' : 'default',
        className: 'mt-3',
      })}
    >
      {tel ? <Phone aria-hidden /> : <ExternalLink aria-hidden />}
      {label}
    </a>
  );
}

function Checklist({ steps }: { steps: EmergencyStep[] }) {
  const { t } = useTranslation();
  const lang = useAppStore((s) => s.lang);
  const [done, setDone] = useState<Set<string>>(new Set());
  return (
    <ol className="flex flex-col gap-3">
      {steps.map((s, i) => {
        const isDone = done.has(s.id);
        const title = l10n(s.title, lang);
        return (
          <li
            key={s.id}
            className={cn(
              'surface flex gap-4 p-4 transition-opacity sm:p-5',
              isDone && 'opacity-60',
            )}
          >
            <button
              type="button"
              role="checkbox"
              aria-checked={isDone}
              aria-label={t('sos.stepDone', { title })}
              onClick={() =>
                setDone((d) => {
                  const n = new Set(d);
                  if (n.has(s.id)) n.delete(s.id);
                  else n.add(s.id);
                  return n;
                })
              }
              className={cn(
                'grid size-tap shrink-0 place-items-center rounded-full border-2 font-mono text-base outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
                isDone
                  ? 'border-risk-safe bg-risk-safe/20 text-risk-safe'
                  : 'border-glass-border text-text-2',
              )}
            >
              {isDone ? <Check className="size-5" aria-hidden /> : i + 1}
            </button>
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  'text-lg font-semibold',
                  isDone && 'line-through decoration-text-2/50',
                )}
              >
                {title}
              </p>
              <p className="mt-1 text-text-2">{l10n(s.body, lang)}</p>
              <StepAction step={s} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Pick recent checks to carry into the complaint draft (M6.2). */
function EvidencePack({ onOpen }: { onOpen: (ids: string[]) => void }) {
  const { t } = useTranslation();
  const lang = useAppStore((s) => s.lang);
  const [scans, setScans] = useState<ScanRecord[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  useEffect(() => {
    void allScans().then((all) => {
      const recent = all.slice(0, 20);
      setScans(recent);
      setPicked(
        new Set(
          recent
            .filter((s) => s.verdict !== 'no_signs')
            .slice(0, 5)
            .map((s) => s.id),
        ),
      );
    });
  }, []);
  return (
    <section aria-labelledby="evidence-title" className="surface p-5 sm:p-6">
      <h2 id="evidence-title" className="text-lg font-semibold">
        {t('sos.evidenceTitle')}
      </h2>
      <p className="mt-1 text-text-2">{t('sos.evidenceHint')}</p>
      {scans && scans.length === 0 && <p className="mt-4 text-text-2">{t('sos.evidenceEmpty')}</p>}
      {scans && scans.length > 0 && (
        <ul className="mt-4 flex flex-col gap-1">
          {scans.map((s) => {
            const Icon = VERDICT_ICON[s.verdict];
            const e = s.result.entities;
            const details = [
              ...e.phones.map((p) => p.raw),
              ...e.upiIds.map((u) => u.raw),
              ...e.urls.map((u) => u.raw),
            ].slice(0, 3);
            return (
              <li key={s.id}>
                <label className="flex min-h-tap cursor-pointer items-start gap-3 rounded-chip p-2 hover:bg-white/5">
                  <input
                    type="checkbox"
                    className="mt-1 size-4.5 accent-[var(--brand)]"
                    checked={picked.has(s.id)}
                    onChange={(ev) =>
                      setPicked((p) => {
                        const n = new Set(p);
                        if (ev.target.checked) n.add(s.id);
                        else n.delete(s.id);
                        return n;
                      })
                    }
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-sm">
                      <Icon className="size-4 shrink-0 text-text-2" aria-hidden />
                      <span className="font-medium">{t(`verdict.${s.verdict}`)}</span>
                      <span className="text-text-2">
                        ·{' '}
                        {new Date(s.createdAt).toLocaleString(
                          lang === 'en' ? 'en-IN' : `${lang}-IN`,
                        )}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-sm text-text-2">
                      {s.inputPreview}
                    </span>
                    {details.length > 0 && (
                      <span className="mt-0.5 block truncate font-mono text-xs text-text-2">
                        {details.join(' · ')}
                      </span>
                    )}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
      <div className="mt-5">
        <p className="text-sm font-medium">{t('sos.evidenceKeep')}</p>
        <ul className="mt-2 list-disc pl-5 text-sm text-text-2">
          {EMERGENCY.evidenceChecklist.map((item, i) => (
            <li key={i}>{l10n(item, lang)}</li>
          ))}
        </ul>
      </div>
      <button
        type="button"
        onClick={() => onOpen([...picked])}
        className={buttonVariants({ size: 'lg', className: 'mt-5' })}
      >
        <FileText aria-hidden />
        {t('sos.openReport')}
      </button>
    </section>
  );
}

/** Emergency mode ("I think I'm being scammed", M6.1): calm, one question at a time. */
export default function SosPage() {
  const { t } = useTranslation();
  usePageTitle(t('page.sos.title'));
  const navigate = useNavigate();
  const lang = useAppStore((s) => s.lang);
  const [answers, setAnswers] = useState<Answers>({});
  const [index, setIndex] = useState(0);
  const finished = index >= QUESTIONS.length;
  const steps = useMemo(
    () => (finished ? buildChecklist(EMERGENCY.steps, answers, QUESTIONS) : []),
    [finished, answers],
  );
  const q = QUESTIONS[index];

  // The previous card stays on screen while it animates out. A tap on it must not
  // change its answer or skip the next question, so only the current one counts.
  const indexRef = useRef(index);
  indexRef.current = index;
  const answer = (qid: QuestionId, yes: boolean) => {
    if (QUESTIONS[indexRef.current]?.id !== qid) return;
    indexRef.current += 1;
    setAnswers((a) => ({ ...a, [qid]: yes }));
    setIndex((i) => i + 1);
  };

  const openReport = (ids: string[]) => {
    const draft: ReportDraft = { answers, scanIds: ids, createdAt: new Date().toISOString() };
    saveDraft(draft);
    navigate('/sos/report', { state: draft });
  };

  return (
    <div className="min-h-dvh bg-[color-mix(in_srgb,var(--risk-scam)_12%,var(--bg))]">
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
        <Link to="/" className={buttonVariants({ variant: 'ghost', className: '-ml-2' })}>
          <X aria-hidden />
          {t('sos.exit')}
        </Link>
        <a href="tel:1930" className={buttonVariants({ variant: 'danger' })}>
          <Phone aria-hidden />
          {t('sos.call1930')}
        </a>
      </header>

      <section
        aria-labelledby="page-title"
        className="mx-auto w-full max-w-3xl px-4 pt-8 pb-16 sm:px-6"
      >
        <h1 id="page-title" className="text-xl font-semibold tracking-tight sm:text-2xl">
          {t('page.sos.title')}
        </h1>
        {!finished && <p className="mt-2 max-w-xl text-text-2">{t('sos.intro')}</p>}

        {!finished && q && (
          <div className="mt-8">
            <div className="flex items-center gap-2" aria-hidden>
              {QUESTIONS.map((x, i) => (
                <span
                  key={x.id}
                  className={cn(
                    'h-1.5 flex-1 rounded-full',
                    i < index ? 'bg-text' : i === index ? 'bg-text/60' : 'bg-white/10',
                  )}
                />
              ))}
            </div>
            <p className="mt-3 text-sm text-text-2" aria-live="polite">
              {t('sos.progress', { n: index + 1, total: QUESTIONS.length })}
            </p>
            <AnimatePresence mode="wait">
              <m.div
                key={q.id}
                data-question={q.id}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={transition.base}
                className="surface mt-4 p-6 sm:p-8"
              >
                <h2 className="text-2xl leading-snug font-semibold text-balance">
                  {l10n(q.text, lang)}
                </h2>
                <div className="mt-8 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => answer(q.id, true)}
                    className="min-h-16 rounded-card border-2 border-text/70 bg-text/10 text-xl font-semibold outline-none hover:bg-text/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                  >
                    {t('sos.yes')}
                  </button>
                  <button
                    type="button"
                    onClick={() => answer(q.id, false)}
                    className="min-h-16 rounded-card border-2 border-glass-border bg-surface-2 text-xl font-semibold outline-none hover:bg-white/8 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                  >
                    {t('sos.no')}
                  </button>
                </div>
              </m.div>
            </AnimatePresence>
            {index > 0 && (
              <button
                type="button"
                onClick={() => setIndex((i) => i - 1)}
                className={buttonVariants({ variant: 'ghost', className: 'mt-3 -ml-2' })}
              >
                <ArrowLeft aria-hidden />
                {t('sos.back')}
              </button>
            )}
          </div>
        )}

        {finished && (
          <m.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={transition.slow}
            className="mt-6 flex flex-col gap-6"
          >
            <div>
              <h2 className="text-xl font-semibold">{t('sos.checklistTitle')}</h2>
              <p className="mt-1 text-text-2">{t('sos.checklistHint')}</p>
            </div>
            <Checklist steps={steps} />
            <EvidencePack onOpen={openReport} />
            <button
              type="button"
              onClick={() => {
                setAnswers({});
                setIndex(0);
              }}
              className={buttonVariants({ variant: 'ghost', className: 'self-start' })}
            >
              <RotateCcw aria-hidden />
              {t('sos.restart')}
            </button>
          </m.div>
        )}
      </section>
    </div>
  );
}
