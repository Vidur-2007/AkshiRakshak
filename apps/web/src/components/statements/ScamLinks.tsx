import { ArrowDownLeft, ArrowUpRight, Ban, FlaskConical, Link2, LifeBuoy } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { buttonVariants } from '@/components/ui/button';
import { subscribe } from '@/lib/broadcast';
import {
  buildEvidence,
  groupLinks,
  linkTransactions,
  paymentsFor,
  type LinkSource,
  type PaidBefore,
  type PayeeLinks,
} from '@/lib/crossLinks';
import {
  addToBlocklist,
  allScans,
  listBlocklist,
  recentStatements,
  type BlockEntry,
  type ScanRecord,
} from '@/lib/db';
import type { AnalysisResult, Txn } from '@/lib/engine';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';

const rupees = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
function useDay() {
  const lang = useAppStore((s) => s.lang);
  return (iso: string) =>
    new Date(iso).toLocaleDateString(`${lang}-IN`, { day: 'numeric', month: 'short' });
}

/** Your checks and blocklist, kept current when another tab or page changes them. */
function useEvidence() {
  const [checks, setChecks] = useState<ScanRecord[]>([]);
  const [blocked, setBlocked] = useState<BlockEntry[]>([]);
  useEffect(() => {
    const load = () => {
      void allScans().then(setChecks);
      void listBlocklist().then(setBlocked);
    };
    load();
    return subscribe((m) => {
      if (m.type === 'scan' || m.type === 'blocklist' || m.type === 'cleared') load();
    });
  }, []);
  return { evidence: useMemo(() => buildEvidence(checks, blocked), [checks, blocked]), blocked };
}

function SourceChip({ s }: { s: LinkSource }) {
  const { t } = useTranslation();
  const day = useDay();
  const chip =
    'inline-flex min-h-8 items-center gap-1.5 rounded-chip border px-2.5 py-1 text-xs leading-snug';
  if (s.kind === 'check')
    return (
      <Link
        to={`/scan/${s.scanId}`}
        className={cn(chip, 'border-risk-scam/40 bg-risk-scam/10 text-text hover:underline')}
      >
        <Link2 className="size-3.5 shrink-0 text-risk-scam" aria-hidden />
        {t(s.scanKind === 'collect_request' ? 'links.fromCollect' : 'links.fromCheck', {
          date: day(s.at),
          verdict: t(`verdict.${s.verdict}`),
          risk: s.risk,
        })}
      </Link>
    );
  if (s.kind === 'blocklist')
    return (
      <span className={cn(chip, 'border-risk-scam/40 bg-risk-scam/10 text-text')}>
        <Ban className="size-3.5 shrink-0 text-risk-scam" aria-hidden />
        {t('links.blocklist')}
      </span>
    );
  return (
    <span className={cn(chip, 'border-glass-border bg-surface-2 text-text')}>
      <FlaskConical className="size-3.5 shrink-0 text-text-2" aria-hidden />
      {s.campaign
        ? t('links.sampleCampaign', {
            campaign: t(`campaigns.${s.campaign}`, { defaultValue: s.campaign }),
          })
        : t('links.sample')}
    </span>
  );
}

function Direction({ txn }: { txn: Txn }) {
  const { t } = useTranslation();
  return txn.direction === 'debit' ? (
    <ArrowUpRight className="size-4 shrink-0 text-risk-scam" aria-label={t('links.out')} />
  ) : (
    <ArrowDownLeft className="size-4 shrink-0 text-risk-warn" aria-label={t('links.in')} />
  );
}

/**
 * Transactions page: payments to (or from) UPI IDs and numbers that also appear in your scam checks,
 * on your blocklist or in Akshi's sample scam data. Hidden when there are none.
 */
export function TxnLinksCard({ txns }: { txns: Txn[] }) {
  const { t } = useTranslation();
  const day = useDay();
  const { evidence, blocked } = useEvidence();
  const groups: PayeeLinks[] = useMemo(
    () => groupLinks(linkTransactions(txns, evidence)),
    [txns, evidence],
  );
  if (!groups.length) return null;
  const isBlocked = (g: PayeeLinks) =>
    g.sources.some((s) => s.kind === 'blocklist') ||
    blocked.some((b) => b.value === g.detail.value);
  const high = groups.some((g) => g.level === 'high');
  return (
    <section
      aria-labelledby="tx-links-title"
      className={cn(
        'surface p-5 sm:p-6',
        high ? 'border-risk-scam/50 ring-1 ring-risk-scam/30' : 'border-risk-warn/40',
      )}
    >
      <h2 id="tx-links-title" className="text-sm font-medium tracking-wide text-text-2 uppercase">
        {t('links.title')}
      </h2>
      <p className="mt-1 text-sm text-text-2">{t('links.hint')}</p>
      <ul className="mt-4 flex flex-col gap-4">
        {groups.map((g) => (
          <li
            key={g.detail.value}
            className="border-t border-glass-border pt-4 first:border-0 first:pt-0"
          >
            <p className="font-mono text-sm break-all text-text">{g.detail.value}</p>
            <p className="mt-0.5 font-medium text-text">
              {[
                g.paidOut > 0 &&
                  t('links.paidTotal', {
                    total: rupees(g.paidOut),
                    n: g.txns.filter((x) => x.direction === 'debit').length,
                  }),
                g.paidIn > 0 &&
                  t('links.receivedTotal', {
                    total: rupees(g.paidIn),
                    n: g.txns.filter((x) => x.direction === 'credit').length,
                  }),
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
            <ul className="mt-2 flex flex-col gap-1" aria-label={t('links.paymentsLabel')}>
              {g.txns.slice(0, 6).map((x) => (
                <li key={x.id} className="flex items-center gap-2 text-sm text-text-2">
                  <Direction txn={x} />
                  <span className="tabular-nums">
                    {rupees(x.amount)} · {day(x.date)}
                  </span>
                </li>
              ))}
              {g.txns.length > 6 && (
                <li className="text-sm text-text-2">{t('links.more', { n: g.txns.length - 6 })}</li>
              )}
            </ul>
            <div className="mt-2 flex flex-wrap gap-2">
              {g.sources.map((s, i) => (
                <SourceChip key={i} s={s} />
              ))}
            </div>
            <p className="mt-2 text-sm text-text-2">
              {t(g.paidOut > 0 ? 'links.adviceDebit' : 'links.adviceCredit')}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {!isBlocked(g) && (
                <button
                  type="button"
                  className={buttonVariants({ variant: 'outline', size: 'sm' })}
                  onClick={() => void addToBlocklist(g.detail.value, g.detail.type)}
                >
                  <Ban aria-hidden />
                  {t('links.block')}
                </button>
              )}
              {g.paidOut > 0 && (
                <Link to="/sos" className={buttonVariants({ variant: 'danger', size: 'sm' })}>
                  <LifeBuoy aria-hidden />
                  {t('links.help')}
                </Link>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Analysis page: earlier payments in your uploaded statements to what this scam asks you to pay. */
export function usePaidBefore(result: Pick<AnalysisResult, 'entities' | 'verdict'>): PaidBefore[] {
  const [statements, setStatements] = useState<Awaited<ReturnType<typeof recentStatements>>>([]);
  useEffect(() => {
    if (result.verdict === 'no_signs') return;
    void recentStatements(20).then(setStatements);
    return subscribe((m) => {
      if (m.type === 'statement' || m.type === 'cleared')
        void recentStatements(20).then(setStatements);
    });
  }, [result.verdict]);
  return useMemo(
    () => (result.verdict === 'no_signs' ? [] : paymentsFor(result, statements)),
    [result, statements],
  );
}

export function PaidBeforeCard({ payments }: { payments: PaidBefore[] }) {
  const { t } = useTranslation();
  const day = useDay();
  if (!payments.length) return null;
  const paidOut = payments.some((p) => p.txn.direction === 'debit');
  return (
    <section
      aria-labelledby="paid-before-title"
      className="surface border-risk-scam/50 p-5 ring-1 ring-risk-scam/30 sm:p-6"
    >
      <h2 id="paid-before-title" className="font-medium text-text">
        {t(paidOut ? 'links.paidBeforeTitle' : 'links.receivedBeforeTitle')}
      </h2>
      <ul className="mt-3 flex flex-col gap-2">
        {payments.slice(0, 5).map((p) => (
          <li key={`${p.statementId}-${p.txn.id}`} className="flex gap-2 text-sm">
            <Direction txn={p.txn} />
            <span>
              {t(p.txn.direction === 'debit' ? 'links.paidRow' : 'links.receivedRow', {
                amount: rupees(p.txn.amount),
                who: p.detail.value,
                date: day(p.txn.date),
                statement: p.statementName,
              })}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm text-text-2">
        {t(paidOut ? 'links.adviceDebit' : 'links.adviceCredit')}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {paidOut && (
          <Link to="/sos" className={buttonVariants({ variant: 'danger', size: 'sm' })}>
            <LifeBuoy aria-hidden />
            {t('links.help')}
          </Link>
        )}
        <Link
          to="/modules/transactions"
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          {t('links.openStatements')}
        </Link>
      </div>
    </section>
  );
}
