import { FlaskConical, Image } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Lang } from '@/lib/engine';
import { loadSampleShot, SAMPLE_SHOTS, sampleShotLangs } from '@/lib/sampleShots';

/**
 * "Sample screenshots": made-up phone screenshots, labelled as sample data (SPEC.md §1.3).
 * Picking one hands a real image file to the screenshot check, so the on-device OCR runs as usual.
 */
export function SampleShots({
  onPick,
  disabled,
  title = true,
}: {
  onPick: (file: File, langs: Lang[]) => void;
  disabled?: boolean;
  /** false inside the screenshot sheet, which has its own heading */
  title?: boolean;
}) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const pick = async (s: (typeof SAMPLE_SHOTS)[number]) => {
    setLoading(s.id);
    setFailed(false);
    try {
      onPick(await loadSampleShot(s), sampleShotLangs(s));
    } catch {
      setFailed(true);
    } finally {
      setLoading(null);
    }
  };

  return (
    <section aria-label={t('shot.samplesTitle')} className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <h2 className={title ? 'text-sm font-medium text-text' : 'text-sm text-text-2'}>
          {title ? t('shot.samplesTitle') : t('shot.trySample')}
        </h2>
        <span className="inline-flex items-center gap-1 rounded-full border border-glass-border px-2 py-0.5 text-xs text-text-2">
          <FlaskConical className="size-3" aria-hidden />
          {t('placeholder.sampleData')}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {SAMPLE_SHOTS.map((s) => (
          <button
            key={s.id}
            type="button"
            disabled={disabled || loading !== null}
            aria-busy={loading === s.id}
            onClick={() => void pick(s)}
            className="inline-flex min-h-10 items-center gap-2 rounded-chip border border-glass-border bg-surface px-3.5 text-sm text-text transition-colors duration-150 hover:border-brand/40 hover:bg-surface-2 disabled:opacity-50 outline-none focus-visible:outline-2 focus-visible:outline-brand"
          >
            <Image className="size-4 text-text-2" aria-hidden />
            {t(s.label)}
          </button>
        ))}
      </div>
      {failed && (
        <p role="alert" className="text-sm text-text">
          {t('shot.sampleFailed')}
        </p>
      )}
    </section>
  );
}
