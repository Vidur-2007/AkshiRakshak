import { ImageUp, ScanSearch } from 'lucide-react';
import { m } from 'motion/react';
import { useId, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { InlineResult, ResultSection } from '@/components/analysis/InlineResult';
import { REVEAL_MS } from '@/components/analysis/reveal';
import { ChatExtras, EmailHeaderCard } from '@/components/modules/ChatViews';
import { ChoiceGroup } from '@/components/modules/ChoiceGroup';
import { ScreenshotFlow, type ScreenshotPayload } from '@/components/scan/ScreenshotFlow';
import { StageTicker } from '@/components/scan/StageTicker';
import { useAnalysis, useScan } from '@/components/scan/useScan';
import { buttonVariants } from '@/components/ui/button';
import { usePageTitle } from '@/hooks/usePageTitle';
import { detectInputKind } from '@/lib/engine';
import { looksLikeEmail } from '@/lib/emailHeaders';
import { fadeUp, stagger } from '@/lib/motion';
import { MAX_INPUT } from '@/lib/scan';
import { TEXT_STAGES } from '@/lib/scanTiming';

export type MessageMode = 'auto' | 'message' | 'chat' | 'email';

/** Auto mode: email headers win over chat-looking lines (the engine's detector can confuse the two). */
export function resolveMode(text: string, mode: MessageMode): 'message' | 'chat' | 'email' {
  if (mode !== 'auto') return mode;
  if (looksLikeEmail(text)) return 'email';
  const k = detectInputKind(text).kind;
  return k === 'chat' || k === 'email' ? k : 'message';
}

export default function MessagesPage() {
  const { t } = useTranslation();
  usePageTitle(t('page.messages.title'));
  const inputId = useId();
  const [text, setText] = useState('');
  const [mode, setMode] = useState<MessageMode>('auto');
  const [shotOpen, setShotOpen] = useState(false);
  const { run, busy, failed, ticker, result } = useAnalysis();
  const scan = useScan();
  const areaRef = useRef<HTMLTextAreaElement>(null);
  // Raw text as sent, for the email header card
  const [sentText, setSentText] = useState('');

  useLayoutEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 480)}px`;
  }, [text]);

  const kind = text.trim() ? resolveMode(text, mode) : null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !kind) return;
    setSentText(text);
    void run({ kind, text });
  };

  const onScreenshot = (p: ScreenshotPayload) => {
    if (p.kind === 'image')
      void scan.runCore({ kind: 'image', text: p.ocr.text, ocr: p.ocr }, { image: p.image });
    else void scan.runCore({ kind: 'message', text: p.text }, { image: p.image });
  };

  const working = busy || scan.busy;

  return (
    <m.section
      variants={stagger(0.06)}
      initial="hidden"
      animate="show"
      aria-labelledby="page-title"
      className="mx-auto w-full max-w-3xl px-4 pt-8 sm:px-6 lg:pt-12"
    >
      <m.h1
        variants={fadeUp}
        id="page-title"
        className="text-xl font-semibold tracking-tight sm:text-2xl"
      >
        {t('page.messages.title')}
      </m.h1>
      <m.p variants={fadeUp} className="mt-2 text-text-2">
        {t('page.messages.body')}
      </m.p>

      <m.form
        variants={fadeUp}
        onSubmit={submit}
        className="glass mt-6 flex flex-col gap-4 rounded-sheet p-3 sm:p-4"
      >
        <ChoiceGroup
          label={t('messages.modeLabel')}
          value={mode}
          onChange={setMode}
          choices={[
            { value: 'auto', label: t('messages.auto') },
            { value: 'message', label: t('kind.message') },
            { value: 'chat', label: t('kind.chat') },
            { value: 'email', label: t('kind.email') },
          ]}
        />
        <div>
          <label htmlFor={inputId} className="sr-only">
            {t('messages.inputLabel')}
          </label>
          <textarea
            ref={areaRef}
            id={inputId}
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={MAX_INPUT}
            rows={6}
            placeholder={t('messages.placeholder')}
            spellCheck={false}
            className="block max-h-[480px] min-h-36 w-full resize-none rounded-card bg-surface/80 px-3 py-3 text-base leading-relaxed text-text outline-none placeholder:text-text-2/70 focus-visible:outline-2 focus-visible:outline-brand"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShotOpen(true)}
            disabled={working}
            className={buttonVariants({ variant: 'outline' })}
          >
            <ImageUp aria-hidden />
            {t('messages.screenshot')}
          </button>
          {kind && mode === 'auto' && (
            <span className="text-sm text-text-2">
              {t('messages.checkedAs', { kind: t(`kind.${kind}`) })}
            </span>
          )}
          <button
            type="submit"
            disabled={!text.trim() || working}
            className={buttonVariants({ size: 'lg', className: 'ml-auto' })}
          >
            <ScanSearch aria-hidden />
            {t('messages.check')}
          </button>
        </div>
      </m.form>

      <div className="min-h-10 px-1 pt-4" aria-live="polite">
        {working && <StageTicker state={busy ? ticker : scan.ticker} stages={TEXT_STAGES} />}
        {(failed || scan.failed) && !working && (
          <p role="alert" className="text-sm">
            {t('scan.error')}
          </p>
        )}
      </div>

      {result && !busy && (
        <div className="mt-2">
          <InlineResult
            result={result}
            before={
              <>
                {result.kind === 'email' && (
                  <ResultSection title={t('messages.emailTitle')} delayMs={REVEAL_MS.verdict + 200}>
                    <EmailHeaderCard text={sentText} />
                  </ResultSection>
                )}
                <ChatExtras result={result} />
              </>
            }
          />
        </div>
      )}

      <ScreenshotFlow open={shotOpen} onOpenChange={setShotOpen} onReady={onScreenshot} />
    </m.section>
  );
}
