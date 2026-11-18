import { CircleCheck, CircleX } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ClaimCheck } from '@/lib/engine';

/** "Claims to be" vs "Actually is" (M1.4). Hidden when the engine found no claims. */
export function ClaimVsRealityCard({ claims }: { claims: ClaimCheck[] }) {
  const { t } = useTranslation();
  if (!claims.length) return null;
  return (
    <div className="overflow-hidden rounded-card border border-glass-border">
      <div className="grid grid-cols-2 bg-surface-2 text-xs font-medium tracking-wide text-text-2 uppercase">
        <span className="px-4 py-2.5">{t('analysis.claimsCol')}</span>
        <span className="border-l border-glass-border px-4 py-2.5">{t('analysis.realityCol')}</span>
      </div>
      <ul>
        {claims.map((c, i) => (
          <li key={i} className="grid grid-cols-2 border-t border-glass-border text-sm">
            <span className="px-4 py-3 text-text">{c.claim}</span>
            <span className="flex items-start gap-2 border-l border-glass-border px-4 py-3 text-text">
              {c.mismatch ? (
                <CircleX
                  className="mt-0.5 size-4 shrink-0 text-risk-scam"
                  aria-label={t('analysis.mismatch')}
                />
              ) : (
                <CircleCheck
                  className="mt-0.5 size-4 shrink-0 text-risk-safe"
                  aria-label={t('analysis.matches')}
                />
              )}
              <span>{c.reality}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
