import { Globe, IndianRupee, QrCode, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { UpiPayload } from '@/lib/engine';
import { upiApp, upiHandle } from '@/lib/psp';

function Row({
  label,
  children,
  mono = false,
}: {
  label: string;
  children: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,8rem)_minmax(0,1fr)] gap-3 border-t border-glass-border py-3 first:border-t-0 first:pt-0">
      <dt className="text-sm text-text-2">{label}</dt>
      <dd className={mono ? 'font-mono text-sm break-all text-text' : 'text-text'}>{children}</dd>
    </div>
  );
}

/** Exactly what a QR contains (§5.6): payee, UPI ID with its app, amount and note. */
export function QRXray({ payload }: { payload: UpiPayload }) {
  const { t } = useTranslation();
  const raw = payload.raw.trim();
  const opensWebsite = !payload.valid && /^https?:\/\//i.test(raw);
  const app = payload.pa ? upiApp(payload.pa) : null;
  return (
    <div className="flex flex-col gap-4">
      {opensWebsite && (
        <p className="flex items-start gap-2 rounded-card border border-risk-warn/40 bg-risk-warn/10 p-3 text-sm text-text">
          <Globe className="mt-0.5 size-4 shrink-0 text-risk-warn" aria-hidden />
          {t('xray.opensWebsite')}
        </p>
      )}
      {!payload.valid && !opensWebsite && (
        <p className="flex items-start gap-2 rounded-card border border-glass-border bg-surface-2 p-3 text-sm text-text">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-text-2" aria-hidden />
          {t('xray.invalid')}
          {payload.issues.length > 0 && (
            <span className="text-text-2"> ({payload.issues.join('; ')})</span>
          )}
        </p>
      )}
      {payload.valid && (
        <dl>
          <Row label={t('xray.payee')}>{payload.pn || t('collect.mockUnknown')}</Row>
          <Row label={t('xray.upiId')} mono>
            {payload.pa ?? '—'}
          </Row>
          {payload.pa && (
            <Row label={t('xray.app')}>
              {app ?? <span className="font-mono text-sm">@{upiHandle(payload.pa)}</span>}
            </Row>
          )}
          <Row label={t('xray.amount')}>
            {payload.am !== undefined ? (
              <span className="inline-flex flex-wrap items-center gap-2">
                <span className="font-mono text-lg font-semibold">
                  ₹{payload.am.toLocaleString('en-IN')}
                </span>
                <span className="rounded-full border border-risk-warn/40 bg-risk-warn/10 px-2 py-0.5 text-xs text-text">
                  {t('xray.prefilled')}
                </span>
              </span>
            ) : (
              <span className="text-text-2">{t('xray.noAmount')}</span>
            )}
          </Row>
          {payload.tn && <Row label={t('xray.note')}>{payload.tn}</Row>}
        </dl>
      )}
      {payload.valid && (
        <p className="flex items-start gap-2 rounded-card bg-surface-2 p-3 text-sm text-text">
          <IndianRupee className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
          {t('xray.payWarning')}
        </p>
      )}
      <details className="group text-sm">
        <summary className="inline-flex min-h-tap cursor-pointer items-center gap-2 text-text-2 hover:text-text">
          <QrCode className="size-4" aria-hidden />
          {t('xray.raw')}
        </summary>
        <pre className="mt-1 overflow-x-auto rounded-chip border border-glass-border bg-surface p-3 font-mono text-xs break-all whitespace-pre-wrap text-text-2">
          {raw}
        </pre>
      </details>
    </div>
  );
}
