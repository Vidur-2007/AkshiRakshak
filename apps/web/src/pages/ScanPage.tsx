import { ClipboardPaste, ImageUp, Mic, QrCode, ShieldCheck, X } from 'lucide-react';
import { AnimatePresence, m } from 'motion/react';
import {
  lazy,
  Suspense,
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
import { ElderScan } from '@/components/elder/ElderScan';
import { AiToggle } from '@/components/scan/AiToggle';
import { DropZone, type DropPayload } from '@/components/scan/DropZone';
import { SampleChips } from '@/components/scan/SampleChips';
import { SampleShots } from '@/components/scan/SampleShots';
import type { Lang } from '@/lib/engine';
import type { ScreenshotPayload } from '@/components/scan/ScreenshotFlow';
import { ScanButton } from '@/components/scan/ScanButton';
import { StageTicker } from '@/components/scan/StageTicker';
import { TypeDetectChip } from '@/components/scan/TypeDetectChip';
import { useScan } from '@/components/scan/useScan';
import type { ScanPrefillState } from '@/components/shell/paletteStore';
import { usePageTitle } from '@/hooks/usePageTitle';
import { orderSamples } from '@/lib/demo';
import { useEngine } from '@/lib/engineLoader';
import { listenSupported } from '@/lib/listen';
import { transition } from '@/lib/motion';
import { MAX_INPUT, toTextKind } from '@/lib/scan';
import { TEXT_STAGES, tickerProgress } from '@/lib/scanTiming';
import { useSession } from '@/lib/session';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';

// Sheets load when first opened; the screenshot flow carries OCR, the QR sheet jsQR.
const ScreenshotFlow = lazy(() =>
  import('@/components/scan/ScreenshotFlow').then((m) => ({ default: m.ScreenshotFlow })),
);
const ListenSheet = lazy(() => import('@/components/scan/ListenSheet'));
const QRScannerSheet = lazy(() =>
  import('@/components/modules/QRScannerSheet').then((m) => ({ default: m.QRScannerSheet })),
);

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

type Sheet = 'screenshot' | 'qr' | 'listen' | null;

const toolBtn =
  'relative inline-flex min-h-10 items-center gap-2 rounded-chip px-3 text-sm text-text-2 transition-colors duration-150 hover:bg-overlay/6 hover:text-text disabled:opacity-50 outline-none focus-visible:outline-2 focus-visible:outline-brand';

export default function ScanPage() {
  const { t } = useTranslation();
  usePageTitle(t('page.scan.title'));
  const location = useLocation();
  const prefill = useMemo(() => readPrefill(location.state), [location.state]);
  const [text, setText] = useState(prefill?.prefill ?? '');
  const [pasteHint, setPasteHint] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [droppedImage, setDroppedImage] = useState<File | null>(null);
  const [droppedLangs, setDroppedLangs] = useState<Lang[] | undefined>(undefined);
  const { run, runCore, busy, failed, ticker } = useScan();
  const inputRef = useAutoGrow(text);
  const elderMode = useAppStore((s) => s.elderMode);
  const inputId = useId();
  const autoRan = useRef(false);

  // The engine loads after first paint (§7); then warmup(lang) loads the model and the
  // lexicons for the UI language, again on a language switch (§5.2, A's request).
  const engine = useEngine();
  const demo = useSession((s) => s.demo);
  const samples = useMemo(() => orderSamples(engine?.SAMPLE_MESSAGES ?? [], demo), [engine, demo]);
  const lang = useAppStore((s) => s.lang);
  useEffect(() => {
    if (engine) void engine.warmup(lang).catch(() => undefined);
  }, [engine, lang]);
  const [sheetsUsed, setSheetsUsed] = useState(false);
  useEffect(() => {
    if (sheet) setSheetsUsed(true);
  }, [sheet]);

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

  const kind = useMemo(
    () => (engine ? toTextKind(engine.detectInputKind(text).kind) : 'message'),
    [engine, text],
  );
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

  // Good OCR → image scan with boxes; weak OCR → the text the user corrected
  const onScreenshot = (p: ScreenshotPayload) => {
    if (p.kind === 'image')
      void runCore({ kind: 'image', text: p.ocr.text, ocr: p.ocr }, { image: p.image });
    else {
      setText(p.text);
      void runCore({ kind: 'message', text: p.text });
    }
  };

  const onDrop = (p: DropPayload) => {
    if (p.kind === 'image') {
      setDroppedImage(p.file);
      setDroppedLangs(undefined);
      setSheet('screenshot');
    } else setText(p.text.slice(0, MAX_INPUT));
  };

  // Live listen (M1.15): needs browser speech recognition and the real engine's listener
  const canListen = !!engine?.createLiveListener && listenSupported();

  const sheets = sheetsUsed && (
    <Suspense fallback={null}>
      <ScreenshotFlow
        open={sheet === 'screenshot'}
        onOpenChange={(o) => !o && setSheet(null)}
        file={droppedImage}
        fileLangs={droppedLangs}
        onReady={onScreenshot}
      />
      <QRScannerSheet
        open={sheet === 'qr'}
        onOpenChange={(o) => !o && setSheet(null)}
        onDecoded={(payload) => void runCore({ kind: 'qr', qrPayload: payload, text: payload })}
      />
      {canListen && (
        <ListenSheet
          open={sheet === 'listen'}
          onOpenChange={(o) => !o && setSheet(null)}
          onScan={(heard) => void run(heard)}
        />
      )}
    </Suspense>
  );

  // Elder Safety Mode: one big input, one big Scan button, screenshot and QR (§5.10)
  if (elderMode) {
    return (
      <>
        <ElderScan
          text={text}
          setText={setText}
          onSubmit={() => submit()}
          busy={busy}
          ticker={ticker}
          onScreenshot={() => {
            setDroppedImage(null);
            setSheet('screenshot');
          }}
          onQr={() => setSheet('qr')}
        />
        {sheets}
      </>
    );
  }

  return (
    <section
      aria-labelledby="page-title"
      className="mx-auto w-full max-w-3xl px-4 pt-8 sm:px-6 lg:pt-12"
    >
      <h1 id="page-title" className="enter-rise text-xl font-semibold tracking-tight sm:text-2xl">
        {t('page.scan.title')}
      </h1>
      <p className="enter-rise mt-2 text-text-2">{t('page.scan.body')}</p>

      <form onSubmit={submit} className="mt-6">
        {/* Shared element: this card morphs into the message panel on /scan/:id (§5.3) */}
        <m.div
          data-tour="scan-card"
          layoutId="scan-card"
          className="glass rounded-sheet p-3 shadow-2xl shadow-black/30 focus-within:border-brand/50 sm:p-4"
        >
          <div className="flex min-h-8 items-center justify-between gap-2 px-1">
            <label htmlFor={inputId} className="text-sm font-medium text-text-2">
              {t('scan.inputLabel')}
            </label>
            <TypeDetectChip kind={kind} visible={hasText && !!engine} />
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
              onClick={() => {
                setDroppedImage(null);
                setSheet('screenshot');
              }}
              className={toolBtn}
              disabled={busy}
              aria-label={t('scan.uploadScreenshot')}
            >
              <ImageUp className="size-4" aria-hidden />
              <span className="hidden sm:inline" aria-hidden>
                {t('scan.uploadScreenshot')}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setSheet('qr')}
              className={toolBtn}
              disabled={busy}
              aria-label={t('scan.scanQr')}
            >
              <QrCode className="size-4" aria-hidden />
              <span className="hidden sm:inline" aria-hidden>
                {t('scan.scanQr')}
              </span>
            </button>
            {canListen && (
              <button
                type="button"
                onClick={() => setSheet('listen')}
                className={toolBtn}
                disabled={busy}
                aria-label={t('listen.open')}
              >
                <Mic className="size-4" aria-hidden />
                <span className="hidden sm:inline" aria-hidden>
                  {t('listen.open')}
                </span>
              </button>
            )}
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

      <div className="enter-rise mt-2 flex flex-col gap-6">
        <AiToggle />
        <SampleChips
          samples={samples}
          disabled={busy}
          onPick={(s) => {
            setText(s.text);
            void run(s.text);
          }}
        />
        <SampleShots
          disabled={busy}
          onPick={(file, langs) => {
            setDroppedImage(file);
            setDroppedLangs(langs);
            setSheet('screenshot');
          }}
        />
        <p className={cn('inline-flex items-start gap-2 text-sm text-text-2')}>
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
          {t('scan.onDevice')}
        </p>
      </div>

      <DropZone onDrop={onDrop} />

      {sheets}
    </section>
  );
}
