import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router';
import { PagePlaceholder } from '@/components/PagePlaceholder';
import type { ScanPrefillState } from '@/components/shell/paletteStore';
import { warmup } from '@/lib/engine';

function readPrefill(state: unknown): string | null {
  if (typeof state !== 'object' || state === null) return null;
  const p = (state as Partial<ScanPrefillState>).prefill;
  return typeof p === 'string' && p.trim() ? p : null;
}

export default function ScanPage() {
  const { t } = useTranslation();
  const prefill = readPrefill(useLocation().state);

  // §5.2: load the model and lexicons as soon as the scan page opens
  useEffect(() => {
    void warmup().catch(() => undefined);
  }, []);

  return (
    <PagePlaceholder pageKey="scan" phase={1}>
      {prefill && (
        <div className="surface p-4">
          <p className="text-sm text-text-2">{t('placeholder.prefilled')}</p>
          <p className="mt-1 line-clamp-4 break-words whitespace-pre-wrap">{prefill}</p>
        </div>
      )}
    </PagePlaceholder>
  );
}
