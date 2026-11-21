import { FlaskConical, ImageUp, ShieldQuestion } from 'lucide-react';
import { m } from 'motion/react';
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { InlineResult, ResultSection } from '@/components/analysis/InlineResult';
import { REVEAL_MS } from '@/components/analysis/reveal';
import { RepeatRequestHint, RepeatRequestsCard } from '@/components/analysis/RepeatRequests';
import { ChoiceGroup } from '@/components/modules/ChoiceGroup';
import { CollectRequestMock } from '@/components/modules/CollectRequestMock';
import { PinPadExplainer } from '@/components/modules/PinPadExplainer';
import { ScreenshotFlow, type ScreenshotPayload } from '@/components/scan/ScreenshotFlow';
import { StageTicker } from '@/components/scan/StageTicker';
import { useAnalysis } from '@/components/scan/useScan';
import { buttonVariants } from '@/components/ui/button';
import { usePageTitle } from '@/hooks/usePageTitle';
import {
  EMPTY_COLLECT,
  prefillFromEntities,
  SAMPLE_COLLECT,
  shouldExplainPin,
  toCollectInput,
  type CollectForm,
} from '@/lib/collect';
import { analyze } from '@/lib/engine';
import { fadeUp, stagger } from '@/lib/motion';
import { TEXT_STAGES } from '@/lib/scanTiming';
import { useAppStore } from '@/lib/store';

function Field({ label, children, id }: { label: string; id: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-text-2">
        {label}
      </label>
      {children}
    </div>
  );
}

const inputClass =
  'min-h-12 rounded-card border border-glass-border bg-surface-2 px-3 text-base text-text outline-none placeholder:text-text-2/60 focus-visible:border-brand';

export default function CollectPage() {
  const { t } = useTranslation();
  usePageTitle(t('page.collect.title'));
  const ids = {
    name: useId(),
    upi: useId(),
    upiHint: useId(),
    amount: useId(),
    note: useId(),
  };
  const [form, setForm] = useState<CollectForm>(EMPTY_COLLECT);
  const [shotOpen, setShotOpen] = useState(false);
  const [prefillNote, setPrefillNote] = useState<string | null>(null);
  const [askedReceive, setAskedReceive] = useState(false);
  const { run, busy, failed, ticker, result } = useAnalysis();
  const set = <K extends keyof CollectForm>(k: K, v: CollectForm[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const check = useCallback(
    (f: CollectForm) => {
      const collect = toCollectInput(f);
      setAskedReceive(collect.toldYouWillReceive);
      void run({ kind: 'collect_request', collect });
    },
    [run],
  );
  const submit = (e: FormEvent) => {
    e.preventDefault();
    check(form);
  };
  const runSample = useCallback(() => {
    setForm(SAMPLE_COLLECT);
    setPrefillNote(null);
    check(SAMPLE_COLLECT);
  }, [check]);

  // ?sample=refund (judge tour, demo): fill in the bundled sample and check it
  const [params] = useSearchParams();
  const sampleRan = useRef(false);
  useEffect(() => {
    if (params.get('sample') === 'refund' && !sampleRan.current) {
      sampleRan.current = true;
      runSample();
    }
  }, [params, runSample]);

  // Screenshot → OCR → fill the fields we can read (UPI ID, amount, note)
  const onScreenshot = async (p: ScreenshotPayload) => {
    const text = p.kind === 'image' ? p.ocr.text : p.text;
    try {
      const { lang } = useAppStore.getState();
      const read = await analyze({ kind: 'message', text, lang });
      const fill = prefillFromEntities(read.entities, read.text);
      setForm((f) => ({ ...f, ...fill }));
      setPrefillNote(Object.keys(fill).length ? t('collect.prefilled') : t('collect.ocrFailed'));
    } catch {
      setPrefillNote(t('collect.ocrFailed'));
    }
  };

  const yesNo = [
    { value: 'yes', label: t('collect.yes') },
    { value: 'no', label: t('collect.no') },
  ] as const;
  const bool = (v: boolean | null) => (v === null ? null : v ? 'yes' : 'no');
  const explain = result ? shouldExplainPin(result, askedReceive) : false;

  return (
    <m.section
      variants={stagger(0.06)}
      initial="hidden"
      animate="show"
      aria-labelledby="page-title"
      className="mx-auto w-full max-w-6xl px-4 pt-8 sm:px-6 lg:pt-12"
    >
      <m.h1
        variants={fadeUp}
        id="page-title"
        className="text-xl font-semibold tracking-tight sm:text-2xl"
      >
        {t('page.collect.title')}
      </m.h1>
      <m.p variants={fadeUp} className="mt-2 max-w-2xl text-text-2">
        {t('page.collect.body')}
      </m.p>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        <m.form variants={fadeUp} onSubmit={submit} className="flex flex-col gap-5">
          <div className="surface flex flex-col gap-4 p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-medium tracking-wide text-text-2 uppercase">
                {t('collect.formTitle')}
              </h2>
              <button
                type="button"
                onClick={() => setShotOpen(true)}
                className={buttonVariants({ variant: 'outline', size: 'sm' })}
              >
                <ImageUp aria-hidden />
                {t('collect.screenshot')}
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full border border-glass-border px-2 py-0.5 text-xs text-text-2">
                <FlaskConical className="size-3" aria-hidden />
                {t('placeholder.sampleData')}
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={runSample}
                className="min-h-10 rounded-chip border border-glass-border bg-surface px-3.5 text-sm text-text transition-colors hover:border-brand/40 disabled:opacity-50 outline-none focus-visible:outline-2 focus-visible:outline-brand"
              >
                {t('collect.sampleRefund')}
              </button>
            </div>
            {prefillNote && (
              <p role="status" className="rounded-chip bg-surface-2 px-3 py-2 text-sm text-text">
                {prefillNote}
              </p>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={t('collect.name')} id={ids.name}>
                <input
                  id={ids.name}
                  value={form.requesterName}
                  maxLength={80}
                  onChange={(e) => set('requesterName', e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label={t('collect.upi')} id={ids.upi}>
                <input
                  id={ids.upi}
                  value={form.requesterUpi}
                  maxLength={80}
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="name@bank"
                  onChange={(e) => set('requesterUpi', e.target.value)}
                  aria-describedby={ids.upiHint}
                  className={`${inputClass} font-mono text-sm`}
                />
                <RepeatRequestHint upi={form.requesterUpi} id={ids.upiHint} />
              </Field>
              <Field label={t('collect.amount')} id={ids.amount}>
                <input
                  id={ids.amount}
                  value={form.amount}
                  inputMode="decimal"
                  maxLength={14}
                  onChange={(e) => set('amount', e.target.value)}
                  className={`${inputClass} font-mono`}
                />
              </Field>
              <Field label={t('collect.note')} id={ids.note}>
                <input
                  id={ids.note}
                  value={form.note}
                  maxLength={120}
                  onChange={(e) => set('note', e.target.value)}
                  className={inputClass}
                />
              </Field>
            </div>
          </div>

          <div className="surface flex flex-col gap-5 p-5 sm:p-6">
            <div>
              <h2 className="text-sm font-medium tracking-wide text-text-2 uppercase">
                {t('collect.questionsTitle')}
              </h2>
              <p className="mt-1 text-sm text-text-2">{t('collect.answerHint')}</p>
            </div>
            <ChoiceGroup
              label={t('collect.qReceive')}
              choices={[...yesNo]}
              value={bool(form.toldYouWillReceive)}
              onChange={(v) => set('toldYouWillReceive', v === 'yes')}
            />
            <ChoiceGroup
              label={t('collect.qFirst')}
              choices={[
                { value: 'them', label: t('collect.them') },
                { value: 'me', label: t('collect.me') },
                { value: 'unknown', label: t('collect.unsure') },
              ]}
              value={form.contactedFirst}
              onChange={(v) => set('contactedFirst', v)}
            />
            <ChoiceGroup
              label={t('collect.qPressure')}
              choices={[...yesNo]}
              value={bool(form.underPressure)}
              onChange={(v) => set('underPressure', v === 'yes')}
            />
            <ChoiceGroup
              label={t('collect.qKnow')}
              choices={[
                { value: 'yes', label: t('collect.yes') },
                { value: 'no', label: t('collect.no') },
                { value: 'unsure', label: t('collect.unsure') },
              ]}
              value={form.knowRequester}
              onChange={(v) => set('knowRequester', v)}
            />
            <button
              type="submit"
              disabled={busy}
              className={buttonVariants({ size: 'lg', className: 'self-start' })}
            >
              <ShieldQuestion aria-hidden />
              {t('collect.check')}
            </button>
          </div>
        </m.form>

        <m.div
          variants={fadeUp}
          className="order-first lg:sticky lg:top-[calc(var(--topbar-h)+24px)] lg:order-none"
        >
          <CollectRequestMock form={form} />
        </m.div>
      </div>

      <div className="min-h-10 px-1 pt-4" aria-live="polite">
        {busy && <StageTicker state={ticker} stages={TEXT_STAGES} />}
        {failed && !busy && (
          <p role="alert" className="text-sm">
            {t('scan.error')}
          </p>
        )}
      </div>

      {result && !busy && (
        <div className="mt-2 max-w-3xl">
          <h2 className="sr-only">{t('collect.resultTitle')}</h2>
          <RepeatRequestsCard result={result} className="mb-4" />
          <InlineResult
            result={result}
            before={
              explain ? (
                <ResultSection
                  title={t('pin.title')}
                  delayMs={REVEAL_MS.verdict + 200}
                  tourId="pin"
                >
                  <PinPadExplainer
                    amount={toCollectInput(form).amount}
                    requesterName={form.requesterName}
                  />
                </ResultSection>
              ) : undefined
            }
          />
        </div>
      )}

      <ScreenshotFlow
        open={shotOpen}
        onOpenChange={setShotOpen}
        onReady={(p) => void onScreenshot(p)}
      />
    </m.section>
  );
}
