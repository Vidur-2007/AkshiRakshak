import { ClipboardPaste, ImageUp, QrCode, ShieldCheck, X } from 'lucide-react';
import { AnimatePresence, m } from 'motion/react';
import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router';
import { AiToggle } from '@/components/scan/AiToggle';
import { DropZone, type DropPayload } from '@/components/scan/DropZone';
import { SampleChips } from '@/components/scan/SampleChips';
import { ScanButton } from '@/components/scan/ScanButton';
import { StageTicker } from '@/components/scan/StageTicker';
import { TypeDetectChip } from '@/components/scan/TypeDetectChip';
import { useScan } from '@/components/scan/useScan';
import type { ScanPrefillState } from '@/components/shell/paletteStore';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { usePageTitle } from '@/hooks/usePageTitle';
import { detectInputKind, warmup } from '@/lib/engine';
import { fadeUp, stagger, transition } from '@/lib/motion';
import { MAX_INPUT, toTextKind } from '@/lib/scan';
import { TEXT_STAGES, tickerProgress } from '@/lib/scanTiming';
import { cn } from '@/lib/utils';

function readPrefill(state: unknown): ScanPrefillState | null {
  if (typeof state !== 'object' || state === null) return null;
  const s = state as Partial<ScanPrefillState>;
  return typeof s.prefill === 'string' && s.prefill.trim()
    ? { prefill: s.prefill, autoScan: s.autoScan === true }
    : null;
}

/** Textarea grows with its content up to a cap, then scrolls. */
function useAutoGrow(value: string, maxPx = 420) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, maxPx)}px`;
  }, [value, maxPx]);
  return ref;
}

type Soon = 'screenshot' | 'qr' | null;

const toolBtn =
  'relative inline-flex min-h-10 items-center gap-2 rounded-chip px-3 text-sm text-text-2 transition-colors duration-150 hover:bg-white/6 hover:text-text disabled:opacity-50 outline-none focus-visible:outline-2 focus-visible:outline-brand';

export default function ScanPage() {
  const { t } = useTranslation();
  usePageTitle(t('page.scan.title'));
  const location = useLocation();
  const prefill = useMemo(() => readPrefill(location.state), [location.state]);
  const [text, setText] = useState(prefill?.prefill ?? '');
  const [pasteHint, setPasteHint] = useState(false);
  const [soon, setSoon] = useState<Soon>(null);
  const { run, busy, failed, ticker } = useScan();
  const inputRef = useAutoGrow(text);
  const inputId = useId();
  const autoRan = useRef(false);

  // §5.2: load the model and lexicons as soon as the scan page opens
  useEffect(() => {
    void warmup().catch(() => undefined);
  }, []);

  // Palette "Paste and scan" and the share target arrive with autoScan
  useEffect(() => {
    if (prefill?.autoScan && !autoRan.current) {
      autoRan.current = true;
      void run(prefill.prefill);
    }
  }, [prefill, run]);

  useEffect(() => {
    if (!pasteHint) return;
    const id = window.setTimeout(() => setPasteHint(false), 3000);
    return () => window.clearTimeout(id);
  }, [pasteHint]);

  const kind = useMemo(() => toTextKind(detectInputKind(text).kind), [text]);
  const hasText = text.trim().length > 0;

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (hasText && !busy) void run(text);
  };

  const paste = async () => {
    try {
      const clip = await navigator.clipboard.readText();
      if (clip) setText(clip.slice(0, MAX_INPUT));
      inputRef.current?.focus();
    } catch {
      setPasteHint(true);
      inputRef.current?.focus();
    }
  };

  const onDrop = (p: DropPayload) => {
    if (p.kind === 'image') setSoon('screenshot');
    else setText(p.text.slice(0, MAX_INPUT));
  };

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
        {t('page.scan.title')}
      </m.h1>
      <m.p variants={fadeUp} className="mt-2 text-text-2">
        {t('page.scan.body')}
      </m.p>

      <form onSubmit={submit} className="mt-6">
        {/* Shared element: this card morphs into the message panel on /scan/:id (§5.3) */}
        <m.div
          layoutId="scan-card"
          className="glass rounded-sheet p-3 shadow-2xl shadow-black/30 focus-within:border-brand/50 sm:p-4"
        >
          <div className="flex min-h-8 items-center justify-between gap-2 px-1">
            <label htmlFor={inputId} className="text-sm font-medium text-text-2">
              {t('scan.inputLabel')}
            </label>
            <TypeDetectChip kind={kind} visible={hasText} />
          </div>
          <textarea
            ref={inputRef}
            id={inputId}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit();
            }}
            maxLength={MAX_INPUT}
            rows={4}
            placeholder={t('scan.placeholder')}
            spellCheck={false}
            autoComplete="off"
            className="mt-2 block max-h-[420px] min-h-28 w-full resize-none rounded-card bg-surface/80 px-3 py-3 text-base leading-relaxed text-text outline-none placeholder:text-text-2/70"
          />
          {text.length >= MAX_INPUT && (
            <p className="px-1 pt-2 text-xs text-text-2">
              {t('scan.tooLong', { max: MAX_INPUT.toLocaleString() })}
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-1">
            <button type="button" onClick={() => void paste()} className={toolBtn} disabled={busy}>
              <ClipboardPaste className="size-4" aria-hidden />
              {t('scan.paste')}
              <AnimatePresence>
                {pasteHint && (
                  <m.span
                    role="status"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={transition.fast}
                    className="absolute bottom-full left-0 mb-2 rounded-chip border border-glass-border bg-surface-2 px-3 py-1.5 text-xs whitespace-nowrap text-text shadow-lg"
                  >
                    {t('scan.pasteDenied')}
                  </m.span>
                )}
              </AnimatePresence>
            </button>
            <button
              type="button"
              onClick={() => setSoon('screenshot')}
              className={toolBtn}
              disabled={busy}
            >
              <ImageUp className="size-4" aria-hidden />
              <span className="hidden sm:inline">{t('scan.uploadScreenshot')}</span>
              <span className="sr-only sm:hidden">{t('scan.uploadScreenshot')}</span>
            </button>
            <button type="button" onClick={() => setSoon('qr')} className={toolBtn} disabled={busy}>
              <QrCode className="size-4" aria-hidden />
              <span className="hidden sm:inline">{t('scan.scanQr')}</span>
              <span className="sr-only sm:hidden">{t('scan.scanQr')}</span>
            </button>
            {hasText && !busy && (
              <button
                type="button"
                onClick={() => {
                  setText('');
                  inputRef.current?.focus();
                }}
                className={toolBtn}
              >
                <X className="size-4" aria-hidden />
                <span className="sr-only">{t('scan.clear')}</span>
              </button>
            )}
            <ScanButton
              busy={busy}
              progress={tickerProgress(ticker)}
              disabled={!hasText}
              className="ml-auto"
            />
          </div>
        </m.div>

        {/* Reserved height so the page does not jump when the ticker appears */}
        <div className="min-h-14 px-2 pt-4" aria-live="polite">
          {busy && <StageTicker state={ticker} stages={TEXT_STAGES} />}
          {failed && !busy && (
            <p role="alert" className="text-sm text-text">
              {t('scan.error')}
            </p>
          )}
        </div>
      </form>

      <m.div variants={fadeUp} className="mt-2 flex flex-col gap-6">
        <AiToggle />
        <SampleChips
          disabled={busy}
          onPick={(s) => {
            setText(s.text);
            void run(s.text);
          }}
        />
        <p className={cn('inline-flex items-start gap-2 text-sm text-text-2')}>
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
          {t('scan.onDevice')}
        </p>
      </m.div>

      <DropZone onDrop={onDrop} />

      <Sheet open={soon !== null} onOpenChange={(o) => !o && setSoon(null)}>
        <SheetContent
          side="bottom"
          closeLabel={t('shell.close')}
          className="mx-auto max-w-xl sm:mb-6 sm:rounded-sheet sm:border"
        >
          <SheetTitle>{t('scan.soonTitle')}</SheetTitle>
          <SheetDescription className="text-base">
            {soon === 'qr' ? t('scan.qrSoon') : t('scan.screenshotSoon')}
          </SheetDescription>
        </SheetContent>
      </Sheet>
    </m.section>
  );
}
