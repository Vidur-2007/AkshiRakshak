import { ImageUp, LoaderCircle, ScanText, ShieldCheck } from 'lucide-react';
import { m } from 'motion/react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { buttonVariants } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { ocrImage, type Lang, type OcrResult } from '@/lib/engine';
import { acceptableImage, isWeakOcr } from '@/lib/ocrQuality';
import { useAppStore } from '@/lib/store';

export type ScreenshotPayload =
  { kind: 'image'; ocr: OcrResult; image: Blob } | { kind: 'text'; text: string; image: Blob };

type Step =
  | { kind: 'choose'; error?: string }
  | { kind: 'reading'; progress: number }
  | { kind: 'weak'; text: string };

export function ocrLangs(lang: Lang): Lang[] {
  return lang === 'en' ? ['en'] : [lang, 'en'];
}

/**
 * Screenshot check (§5.7): preview, on-device OCR with progress, then either the
 * OCR result (good read) or an editable text box (weak read).
 */
export function ScreenshotFlow({
  open,
  onOpenChange,
  file,
  onReady,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** a file already chosen (drop or picker outside the sheet) */
  file?: File | null;
  onReady: (payload: ScreenshotPayload) => void;
}) {
  const { t } = useTranslation();
  const lang = useAppStore((s) => s.lang);
  const textId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>({ kind: 'choose' });
  const [blob, setBlob] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const runId = useRef(0);
  // Parent callbacks change every render; keep them out of effect dependencies.
  const readyRef = useRef(onReady);
  const openRef = useRef(onOpenChange);
  readyRef.current = onReady;
  openRef.current = onOpenChange;

  useEffect(() => {
    if (!blob) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(blob);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [blob]);

  const read = useCallback(
    async (f: File) => {
      if (!acceptableImage(f)) {
        setStep({ kind: 'choose', error: t('shot.notImage') });
        return;
      }
      const id = ++runId.current;
      setBlob(f);
      setStep({ kind: 'reading', progress: 0 });
      try {
        const ocr = await ocrImage(
          f,
          ocrLangs(lang),
          (p) => id === runId.current && setStep({ kind: 'reading', progress: p }),
        );
        if (id !== runId.current) return;
        if (isWeakOcr(ocr)) setStep({ kind: 'weak', text: ocr.text });
        else {
          readyRef.current({ kind: 'image', ocr, image: f });
          openRef.current(false);
        }
      } catch {
        if (id === runId.current) setStep({ kind: 'weak', text: '' });
      }
    },
    [lang, t],
  );

  // Reset on open; start at once when a file was handed in
  useEffect(() => {
    if (!open) {
      runId.current++;
      return;
    }
    setStep({ kind: 'choose' });
    setBlob(null);
    if (file) void read(file);
  }, [open, file, read]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        closeLabel={t('shell.close')}
        className="mx-auto max-w-lg sm:mb-6 sm:rounded-sheet sm:border"
      >
        <SheetTitle className="pr-10">{t('shot.title')}</SheetTitle>
        <SheetDescription className="inline-flex items-center gap-2">
          <ShieldCheck className="size-4 shrink-0 text-brand" aria-hidden />
          {t('shot.reading')}
        </SheetDescription>

        {preview && (
          <img
            src={preview}
            alt={t('shot.preview')}
            className="mx-auto max-h-[38dvh] w-auto rounded-card border border-glass-border object-contain"
          />
        )}

        <input
          ref={fileRef}
          type="file"
          aria-label={t('shot.choose')}
          accept="image/*"
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void read(f);
            e.target.value = '';
          }}
        />

        {step.kind === 'choose' && (
          <>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className={buttonVariants({ size: 'lg', className: 'w-full' })}
            >
              <ImageUp aria-hidden />
              {t('shot.choose')}
            </button>
            {step.error && (
              <p role="alert" className="text-center text-sm text-text">
                {step.error}
              </p>
            )}
          </>
        )}

        {step.kind === 'reading' && (
          <div role="status" aria-live="polite" className="flex flex-col gap-2">
            <div
              className="h-2 overflow-hidden rounded-full bg-white/8"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(step.progress * 100)}
              aria-label={t('shot.reading')}
            >
              <m.div
                className="h-full rounded-full bg-brand"
                style={{ originX: 0 }}
                animate={{ scaleX: Math.max(0.04, step.progress) }}
                transition={{ duration: 0.25 }}
              />
            </div>
            <p className="inline-flex items-center gap-2 text-sm text-text-2">
              <LoaderCircle className="size-4 animate-spin" aria-hidden />
              {Math.round(step.progress * 100)}%
            </p>
          </div>
        )}

        {step.kind === 'weak' && (
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!step.text.trim() || !blob) return;
              onReady({ kind: 'text', text: step.text, image: blob });
              onOpenChange(false);
            }}
          >
            <div>
              <p className="font-medium">{t('shot.weakTitle')}</p>
              <p className="mt-1 text-sm text-text-2">{t('shot.weakBody')}</p>
            </div>
            <label htmlFor={textId} className="sr-only">
              {t('scan.inputLabel')}
            </label>
            <textarea
              id={textId}
              value={step.text}
              onChange={(e) => setStep({ kind: 'weak', text: e.target.value })}
              rows={5}
              className="w-full resize-y rounded-card border border-glass-border bg-surface p-3 text-base text-text outline-none focus-visible:border-brand"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={!step.text.trim()}
                className={buttonVariants({ size: 'lg' })}
              >
                <ScanText aria-hidden />
                {t('shot.checkText')}
              </button>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className={buttonVariants({ variant: 'outline', size: 'lg' })}
              >
                {t('shot.another')}
              </button>
            </div>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}
