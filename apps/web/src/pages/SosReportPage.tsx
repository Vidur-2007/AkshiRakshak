import { ArrowLeft, Printer } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router';
import { buttonVariants } from '@/components/ui/button';
import { usePageTitle } from '@/hooks/usePageTitle';
import { scansByIds, type ScanRecord } from '@/lib/db';
import { loadDraft, type ReportDraft } from '@/lib/emergency';
import { EMERGENCY, type Lang } from '@/lib/engine';
import { l10n } from '@/lib/l10n';
import { useAppStore } from '@/lib/store';
import '@/styles/print.css';

function readDraft(state: unknown): ReportDraft | null {
  if (typeof state === 'object' && state !== null && Array.isArray((state as ReportDraft).scanIds))
    return state as ReportDraft;
  return loadDraft();
}

const locale = (lang: Lang) => (lang === 'en' ? 'en-IN' : `${lang}-IN`);

export function collectEntities(scans: ScanRecord[]) {
  const uniq = (xs: string[]) => [...new Set(xs.map((x) => x.trim()).filter(Boolean))];
  return {
    phones: uniq(scans.flatMap((s) => s.result.entities.phones.map((p) => p.raw))),
    upiIds: uniq(
      scans.flatMap((s) => [
        ...s.result.entities.upiIds.map((u) => u.raw),
        ...(s.result.qr?.pa ? [s.result.qr.pa] : []),
      ]),
    ),
    links: uniq(scans.flatMap((s) => s.result.entities.urls.map((u) => u.raw))),
    amounts: uniq(
      scans.flatMap((s) =>
        s.result.entities.amounts.map((a) => `₹${a.value.toLocaleString('en-IN')}`),
      ),
    ),
  };
}

/** Printable complaint draft (M6.2): timeline, details, answers and a blank account section. */
export default function SosReportPage() {
  const { t } = useTranslation();
  usePageTitle(t('report.title'));
  const lang = useAppStore((s) => s.lang);
  const { state } = useLocation();
  const draft = useMemo(() => readDraft(state), [state]);
  const [scans, setScans] = useState<ScanRecord[]>([]);

  useEffect(() => {
    if (!draft?.scanIds.length) return;
    void scansByIds(draft.scanIds).then((rows) =>
      setScans([...rows].sort((a, b) => a.createdAt.localeCompare(b.createdAt))),
    );
  }, [draft]);

  const ents = collectEntities(scans);
  const yes = EMERGENCY.questions.filter((q) => draft?.answers[q.id] === true);
  const no = EMERGENCY.questions.filter((q) => draft?.answers[q.id] === false);
  const fmt = (iso: string) => new Date(iso).toLocaleString(locale(lang));
  const entityRows: [string, string[]][] = [
    [t('analysis.phones'), ents.phones],
    [t('analysis.upiIds'), ents.upiIds],
    [t('analysis.links'), ents.links],
    [t('analysis.amounts'), ents.amounts],
  ];

  return (
    <div className="min-h-dvh bg-bg">
      <div className="no-print mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
        <Link to="/sos" className={buttonVariants({ variant: 'ghost', className: '-ml-2' })}>
          <ArrowLeft aria-hidden />
          {t('report.back')}
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className={buttonVariants({ size: 'lg' })}
        >
          <Printer aria-hidden />
          {t('report.print')}
        </button>
      </div>

      <article className="print-sheet mx-auto mt-6 w-full max-w-3xl px-4 pb-16 sm:px-6">
        <div className="surface flex flex-col gap-6 p-6 sm:p-8">
          <header>
            <h1 className="text-2xl font-semibold">{t('report.title')}</h1>
            <p className="mt-1 text-sm text-text-2">
              {t('report.generated', { date: fmt(draft?.createdAt ?? new Date().toISOString()) })}
            </p>
            <p className="mt-3 rounded-chip border border-glass-border p-3 text-sm text-text">
              {t('report.notice')}
            </p>
          </header>

          <section>
            <h2 className="text-lg font-semibold">{t('report.whatHappened')}</h2>
            <p className="mt-1 text-sm text-text-2">{t('report.whatHappenedHint')}</p>
            <div
              className="print-lines mt-3 min-h-40 rounded-chip border border-glass-border bg-surface-2 p-3 text-base outline-none"
              contentEditable
              suppressContentEditableWarning
              role="textbox"
              aria-multiline="true"
              aria-label={t('report.whatHappened')}
            />
          </section>

          <section>
            <h2 className="text-lg font-semibold">{t('report.answers')}</h2>
            <ul className="mt-2 flex flex-col gap-1 text-sm">
              {yes.map((q) => (
                <li key={q.id}>
                  <strong>{t('sos.yes')}:</strong> {l10n(q.text, lang)}
                </li>
              ))}
              {no.map((q) => (
                <li key={q.id} className="text-text-2">
                  {t('sos.no')}: {l10n(q.text, lang)}
                </li>
              ))}
              {!yes.length && !no.length && <li className="text-text-2">{t('report.none')}</li>}
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold">{t('report.timeline')}</h2>
            {scans.length === 0 ? (
              <p className="mt-2 text-sm text-text-2">{t('report.noScans')}</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-glass-border text-text-2">
                      <th className="py-2 pr-3 font-medium">{t('report.colTime')}</th>
                      <th className="py-2 pr-3 font-medium">{t('report.colKind')}</th>
                      <th className="py-2 pr-3 font-medium">{t('report.colVerdict')}</th>
                      <th className="py-2 font-medium">{t('report.colDetails')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scans.map((s) => (
                      <tr key={s.id} className="border-b border-glass-border align-top">
                        <td className="py-2 pr-3 whitespace-nowrap">{fmt(s.createdAt)}</td>
                        <td className="py-2 pr-3">{t(`kind.${s.kind}`)}</td>
                        <td className="py-2 pr-3">
                          {t(`verdict.${s.verdict}`)} ({s.riskScore}/100)
                        </td>
                        <td className="py-2 break-words">{s.result.text.slice(0, 400)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section>
            <h2 className="text-lg font-semibold">{t('report.entities')}</h2>
            <dl className="mt-2 grid grid-cols-1 gap-2 text-sm sm:grid-cols-[10rem_minmax(0,1fr)]">
              {entityRows.map(([label, values]) => (
                <div key={label} className="contents">
                  <dt className="text-text-2">{label}</dt>
                  <dd className="font-mono break-all">
                    {values.length ? values.join(', ') : t('report.none')}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <section>
            <h2 className="text-lg font-semibold">{t('report.checklist')}</h2>
            <ul className="mt-2 list-disc pl-5 text-sm">
              {EMERGENCY.evidenceChecklist.map((item, i) => (
                <li key={i}>{l10n(item, lang)}</li>
              ))}
            </ul>
          </section>
        </div>
      </article>
    </div>
  );
}
