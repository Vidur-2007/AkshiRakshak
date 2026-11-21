import { Ban, Repeat } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { buttonVariants } from '@/components/ui/button';
import { subscribe } from '@/lib/broadcast';
import { addToBlocklist, allScans, type ScanRecord } from '@/lib/db';
import type { AnalysisResult } from '@/lib/engine';
import { priorRequests, requesterOf, sameAmountCount } from '@/lib/repeatRequests';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';

const rupees = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

/** Your check history, kept current as checks are added or cleared. */
function useHistory(): ScanRecord[] {
  const [history, setHistory] = useState<ScanRecord[]>([]);
  useEffect(() => {
    void allScans().then(setHistory);
    return subscribe((m) => {
      if (m.type === 'scan' || m.type === 'cleared') void allScans().then(setHistory);
    });
  }, []);
  return history;
}

function useDay() {
  const lang = useAppStore((s) => s.lang);
  return (iso: string) =>
    new Date(iso).toLocaleDateString(`${lang}-IN`, { day: 'numeric', month: 'short' });
}

/**
 * On a collect-request result: how many times this UPI ID asked you for money before (from your
 * history), how many for the same amount, and what to do. Hidden for a first request.
 */
export function RepeatRequestsCard({
  result,
  className,
}: {
  result: Pick<AnalysisResult, 'id' | 'kind' | 'entities'>;
  className?: string;
}) {
  const { t } = useTranslation();
  const day = useDay();
  const history = useHistory();
  const [blocked, setBlocked] = useState(false);
  const upi = requesterOf(result);
  const prior = useMemo(
    () => (upi ? priorRequests(upi, history, result.id) : []),
    [upi, history, result.id],
  );
  if (!upi || !prior.length) return null;
  const amount = result.entities.amounts[0]?.value ?? null;
  const same = sameAmountCount(prior, amount);
  return (
    <section
      aria-labelledby="repeat-title"
      className={cn('surface border-risk-warn/50 p-5 ring-1 ring-risk-warn/30 sm:p-6', className)}
    >
      <h2 id="repeat-title" className="flex items-center gap-2 font-medium text-text">
        <Repeat className="size-4 shrink-0 text-risk-warn" aria-hidden />
        {t('repeat.title', { n: prior.length })}
      </h2>
      <p className="mt-1 font-mono text-sm break-all text-text-2">{upi}</p>
      <ul className="mt-3 flex flex-col gap-1.5" aria-label={t('repeat.listLabel')}>
        {prior.slice(0, 5).map((p) => (
          <li key={p.scanId} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="tabular-nums text-text">
              {p.amount !== null ? rupees(p.amount) : t('repeat.noAmount')} · {day(p.at)}
            </span>
            <Link
              to={`/scan/${p.scanId}`}
              className="rounded-chip border border-glass-border px-2 py-0.5 text-xs text-text-2 hover:underline"
            >
              {t(`verdict.${p.verdict}`)} {p.risk}
            </Link>
          </li>
        ))}
      </ul>
      {same > 0 && amount !== null && (
        <p className="mt-2 text-sm font-medium text-text">
          {t('repeat.same', { n: same, amount: rupees(amount) })}
        </p>
      )}
      <p className="mt-2 text-sm text-text-2">{t('repeat.advice')}</p>
      <button
        type="button"
        disabled={blocked}
        onClick={() => void addToBlocklist(upi, 'upi').then(() => setBlocked(true))}
        className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'mt-3')}
      >
        <Ban aria-hidden />
        {blocked ? t('repeat.blocked') : t('repeat.block')}
      </button>
    </section>
  );
}

/** Under the requester's UPI ID on the collect form: earlier requests from it, as you type. */
export function RepeatRequestHint({ upi, id }: { upi: string; id?: string }) {
  const { t } = useTranslation();
  const day = useDay();
  const history = useHistory();
  const prior = useMemo(() => priorRequests(upi, history), [upi, history]);
  const latest = prior[0];
  // always rendered (the input points at it); announced when it fills in
  return (
    <p id={id} aria-live="polite" className="flex items-start gap-2 text-sm text-text empty:hidden">
      {latest && (
        <>
          <Repeat className="mt-0.5 size-4 shrink-0 text-risk-warn" aria-hidden />
          <span>
            {t('repeat.hint', { n: prior.length, date: day(latest.at) })}{' '}
            <Link to={`/scan/${latest.scanId}`} className="underline underline-offset-2">
              {t('repeat.openLatest')}
            </Link>
          </span>
        </>
      )}
    </p>
  );
}
