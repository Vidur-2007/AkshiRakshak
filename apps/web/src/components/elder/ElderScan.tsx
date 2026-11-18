import { ImageUp, QrCode, ScanLine } from 'lucide-react';
import { useId, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { StageTicker } from '@/components/scan/StageTicker';
import { MAX_INPUT } from '@/lib/scan';
import { TEXT_STAGES, type TickerState } from '@/lib/scanTiming';
import { cn } from '@/lib/utils';

/** Kept out of ElderViews so the Elder scan page does not load the engine eagerly. */
const bigBtn =
  'inline-flex min-h-16 w-full items-center justify-center gap-3 rounded-card px-6 text-xl font-semibold outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand';

/** Elder mode Quick Scan (§5.10): one big input, one big Scan button, screenshot, QR. */
export function ElderScan({
  text,
  setText,
  onSubmit,
  busy,
  ticker,
  onScreenshot,
  onQr,
}: {
  text: string;
  setText: (v: string) => void;
  onSubmit: () => void;
  busy: boolean;
  ticker: TickerState;
  onScreenshot: () => void;
  onQr: () => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit();
  };
  return (
    <section
      aria-labelledby="page-title"
      className="mx-auto flex w-full max-w-xl flex-col gap-5 px-4 pt-8"
    >
      <h1 id="page-title" className="text-2xl font-semibold">
        {t('elder.title')}
      </h1>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <label htmlFor={id} className="text-lg">
          {t('scan.inputLabel')}
        </label>
        <textarea
          id={id}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          maxLength={MAX_INPUT}
          placeholder={t('scan.placeholder')}
          className="w-full resize-y rounded-card border-2 border-glass-border bg-surface p-4 text-xl leading-relaxed text-text outline-none focus-visible:border-brand"
        />
        <button
          type="submit"
          disabled={!text.trim() || busy}
          className={cn(bigBtn, 'bg-brand text-brand-contrast disabled:opacity-50')}
        >
          <ScanLine className="size-7" aria-hidden />
          {busy ? t('scan.scanning') : t('elder.scan')}
        </button>
      </form>
      {busy && <StageTicker state={ticker} stages={TEXT_STAGES} />}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={onScreenshot}
          className={cn(bigBtn, 'border-2 border-glass-border bg-surface-2 text-text')}
        >
          <ImageUp className="size-6" aria-hidden />
          {t('scan.uploadScreenshot')}
        </button>
        <button
          type="button"
          onClick={onQr}
          className={cn(bigBtn, 'border-2 border-glass-border bg-surface-2 text-text')}
        >
          <QrCode className="size-6" aria-hidden />
          {t('scan.scanQr')}
        </button>
      </div>
    </section>
  );
}
