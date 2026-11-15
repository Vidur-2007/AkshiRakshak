import { FlaskConical } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { SampleMessage } from '@/lib/engine';
import { l10n } from '@/lib/l10n';
import { useAppStore } from '@/lib/store';

export { l10n } from '@/lib/l10n';

/** Bundled samples (M1.8), labelled "Sample data" (SPEC.md §1.3). Clicking fills the input and scans. */
export function SampleChips({
  samples,
  onPick,
  disabled,
}: {
  /** SAMPLE_MESSAGES, passed in once the engine has loaded (empty before) */
  samples: readonly SampleMessage[];
  onPick: (s: SampleMessage) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const lang = useAppStore((s) => s.lang);
  return (
    <section aria-labelledby="samples-title" className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <h2 id="samples-title" className="text-sm font-medium text-text">
          {t('scan.samplesTitle')}
        </h2>
        <span className="inline-flex items-center gap-1 rounded-full border border-glass-border px-2 py-0.5 text-xs text-text-2">
          <FlaskConical className="size-3" aria-hidden />
          {t('placeholder.sampleData')}
        </span>
      </div>
      <div className="flex min-h-10 flex-wrap gap-2">
        {samples.map((s) => (
          <button
            key={s.id}
            type="button"
            disabled={disabled}
            onClick={() => onPick(s)}
            className="min-h-10 rounded-chip border border-glass-border bg-surface px-3.5 text-sm text-text transition-colors duration-150 hover:border-brand/40 hover:bg-surface-2 disabled:opacity-50 outline-none focus-visible:outline-2 focus-visible:outline-brand"
          >
            {l10n(s.label, lang)}
          </button>
        ))}
      </div>
    </section>
  );
}
