import { useTranslation } from 'react-i18next';
import type { CollectForm } from '@/lib/collect';
import { parseAmount } from '@/lib/collect';

/** A generic phone frame that redraws the collect request as the form is filled (§5.4). */
export function CollectRequestMock({ form }: { form: CollectForm }) {
  const { t } = useTranslation();
  const name = form.requesterName.trim() || t('collect.mockUnknown');
  const upi = form.requesterUpi.trim();
  const amount = parseAmount(form.amount);
  const initial = name.charAt(0).toUpperCase();
  return (
    <figure aria-label={t('collect.mockTitle')} className="mx-auto w-full max-w-[17rem]">
      <div className="rounded-[2.25rem] border-[6px] border-surface-2 bg-bg p-2 shadow-2xl shadow-black/50 ring-1 ring-glass-border">
        <div className="mx-auto mb-2 h-1.5 w-16 rounded-full bg-surface-2" aria-hidden />
        <div className="flex min-h-[25rem] flex-col rounded-[1.6rem] bg-surface px-4 pt-5 pb-4">
          <p className="text-center text-xs tracking-wide text-text-2 uppercase">
            {t('collect.mockRequest')}
          </p>
          <div className="mt-5 flex flex-col items-center gap-2 text-center">
            <span
              className="grid size-14 place-items-center rounded-full bg-surface-2 text-xl font-semibold text-text"
              aria-hidden
            >
              {initial}
            </span>
            <span className="max-w-full truncate font-medium text-text">{name}</span>
            <span className="max-w-full truncate font-mono text-xs text-text-2">
              {upi || '—@—'}
            </span>
          </div>
          <p className="mt-6 text-center font-mono text-3xl font-semibold tabular-nums">
            ₹{amount !== undefined ? amount.toLocaleString('en-IN') : '—'}
          </p>
          {form.note.trim() && (
            <p className="mx-auto mt-3 max-w-full rounded-chip bg-surface-2 px-3 py-1.5 text-center text-xs break-words text-text">
              “{form.note.trim()}”
            </p>
          )}
          <div className="mt-auto grid grid-cols-2 gap-2 pt-6" aria-hidden>
            <span className="grid h-11 place-items-center rounded-full border border-glass-border text-sm text-text">
              {t('collect.mockDecline')}
            </span>
            <span className="grid h-11 place-items-center rounded-full bg-text text-sm font-semibold text-bg">
              {t('collect.mockPay')}
            </span>
          </div>
        </div>
      </div>
      <figcaption className="mt-2 text-center text-xs text-text-2">
        {t('collect.mockTitle')}
      </figcaption>
    </figure>
  );
}
