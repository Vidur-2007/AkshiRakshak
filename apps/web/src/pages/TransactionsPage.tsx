import { FileSpreadsheet, FlaskConical, History, RotateCcw, Upload } from 'lucide-react';
import { m } from 'motion/react';
import { useEffect, useRef, useState, type DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ResultSection } from '@/components/analysis/InlineResult';
import { RevealProvider } from '@/components/analysis/reveal';
import { RiskGauge } from '@/components/analysis/RiskGauge';
import {
  AnomalyCard,
  parseErrorRow,
  sortAnomalies,
  SpendingSummary,
  StatementChart,
} from '@/components/statements/StatementViews';
import { buttonVariants } from '@/components/ui/button';
import { usePageTitle } from '@/hooks/usePageTitle';
import { recentStatements, saveStatement, type StatementRecord } from '@/lib/db';
import {
  analyzeStatement,
  parseStatementCsv,
  SAMPLE_STATEMENTS,
  type StatementAnalysis,
  type Verdict,
} from '@/lib/engine';
import { l10n } from '@/lib/l10n';
import { fadeUp, stagger } from '@/lib/motion';
import { useAppStore } from '@/lib/store';

const MAX_CSV_BYTES = 5 * 1024 * 1024;

/** A .csv name or a CSV/plain-text type, up to 5 MB. */
export function acceptableCsv(file: Pick<File, 'name' | 'type' | 'size'>): boolean {
  const looksCsv = /\.csv$/i.test(file.name) || /csv|^text\/plain$/i.test(file.type);
  return looksCsv && file.size <= MAX_CSV_BYTES;
}

export function statementVerdict(score: number): Verdict {
  if (score >= 70) return 'scam';
  if (score >= 40) return 'suspicious';
  return 'no_signs';
}

interface Loaded {
  name: string;
  analysis: StatementAnalysis;
  errors: string[];
}

/** Statement scan (§5.8): parse on the device, analyse, explain, save to history. */
export default function TransactionsPage() {
  const { t } = useTranslation();
  usePageTitle(t('page.transactions.title'));
  const lang = useAppStore((s) => s.lang);
  const fileRef = useRef<HTMLInputElement>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [recent, setRecent] = useState<StatementRecord[]>([]);
  const [drag, setDrag] = useState(false);

  useEffect(() => {
    void recentStatements().then(setRecent);
  }, []);

  const run = (name: string, csv: string) => {
    setFileError(null);
    const parsed = parseStatementCsv(csv);
    setErrors(parsed.errors);
    if (parsed.txns.length === 0) {
      setLoaded(null);
      return;
    }
    const analysis = analyzeStatement(parsed.txns, lang);
    setLoaded({ name, analysis, errors: parsed.errors });
    setSelected(sortAnomalies(analysis.anomalies)[0]?.id ?? null);
    void saveStatement(name, analysis).then(() => recentStatements().then(setRecent));
  };

  const readFile = async (file: File | undefined) => {
    if (!file) return;
    if (!acceptableCsv(file)) {
      setFileError(t('tx.notCsv'));
      return;
    }
    run(file.name, await file.text());
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDrag(false);
    void readFile(e.dataTransfer.files[0]);
  };

  const a = loaded?.analysis;
  const anomalies = a ? sortAnomalies(a.anomalies) : [];
  const current = anomalies.find((x) => x.id === selected) ?? anomalies[0];

  return (
    <m.section
      variants={stagger(0.06)}
      initial="hidden"
      animate="show"
      aria-labelledby="page-title"
      className="mx-auto w-full max-w-5xl px-4 pt-8 sm:px-6 lg:pt-12"
    >
      <m.h1
        variants={fadeUp}
        id="page-title"
        className="text-xl font-semibold tracking-tight sm:text-2xl"
      >
        {t('page.transactions.title')}
      </m.h1>
      <m.p variants={fadeUp} className="mt-2 max-w-2xl text-text-2">
        {t('page.transactions.body')}
      </m.p>

      {!a && (
        <m.div variants={fadeUp} className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={onDrop}
            className={`flex flex-col items-start gap-3 rounded-sheet border-2 border-dashed p-6 transition-colors ${drag ? 'border-brand bg-brand/5' : 'border-glass-border bg-surface'}`}
          >
            <FileSpreadsheet className="size-8 text-brand" aria-hidden />
            <p className="text-text-2">{t('tx.uploadHint')}</p>
            <input
              ref={fileRef}
              type="file"
              aria-label={t('tx.upload')}
              accept=".csv,text/csv"
              className="sr-only"
              tabIndex={-1}
              onChange={(e) => {
                void readFile(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className={buttonVariants({ size: 'lg' })}
            >
              <Upload aria-hidden />
              {t('tx.upload')}
            </button>
            {fileError && (
              <p role="alert" className="text-sm">
                {fileError}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-medium">{t('tx.samplesTitle')}</h2>
              <span className="inline-flex items-center gap-1 rounded-full border border-glass-border px-2 py-0.5 text-xs text-text-2">
                <FlaskConical className="size-3" aria-hidden />
                {t('placeholder.sampleData')}
              </span>
            </div>
            {SAMPLE_STATEMENTS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => run(l10n(s.title, lang), s.csv)}
                className="surface flex flex-col items-start gap-1 p-4 text-left transition-colors hover:border-brand/40 outline-none focus-visible:outline-2 focus-visible:outline-brand"
              >
                <span className="font-medium">{l10n(s.title, lang)}</span>
                <span className="text-sm text-text-2">{s.persona}</span>
              </button>
            ))}
            {recent.length > 0 && (
              <div className="mt-2">
                <h2 className="mb-2 inline-flex items-center gap-2 text-sm font-medium">
                  <History className="size-4 text-text-2" aria-hidden />
                  {t('tx.recent')}
                </h2>
                <ul className="flex flex-col gap-1">
                  {recent.map((r) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setErrors([]);
                          setLoaded({ name: r.name, analysis: r.analysis, errors: [] });
                          setSelected(sortAnomalies(r.analysis.anomalies)[0]?.id ?? null);
                        }}
                        className="flex min-h-tap w-full items-center justify-between gap-3 rounded-chip px-3 text-left text-sm hover:bg-overlay/5 outline-none focus-visible:outline-2 focus-visible:outline-brand"
                      >
                        <span className="truncate">{r.name}</span>
                        <span className="shrink-0 text-xs text-text-2">
                          {t('tx.txnCount', { n: r.analysis.txns.length })}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </m.div>
      )}

      {errors.length > 0 && (
        <section className="surface mt-6 p-5" aria-labelledby="errors-title">
          <h2 id="errors-title" className="text-sm font-medium tracking-wide text-text-2 uppercase">
            {t('tx.errorsTitle')}
          </h2>
          <ul className="mt-3 flex flex-col gap-1 font-mono text-sm">
            {errors.slice(0, 50).map((e, i) => {
              const p = parseErrorRow(e);
              return (
                <li key={i}>
                  {p.row !== null
                    ? t('tx.errorsRow', { row: p.row, message: p.message })
                    : p.message}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {a && loaded && (
        <RevealProvider>
          <div className="mt-6 flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="inline-flex items-center gap-2 text-sm text-text-2">
                <FileSpreadsheet className="size-4" aria-hidden />
                {loaded.name} · {t('tx.txnCount', { n: a.txns.length })}
              </p>
              <button
                type="button"
                onClick={() => {
                  setLoaded(null);
                  setErrors([]);
                }}
                className={buttonVariants({ variant: 'outline', size: 'sm' })}
              >
                <RotateCcw aria-hidden />
                {t('tx.chooseAnother')}
              </button>
            </div>
            <section className="surface flex flex-col items-center gap-5 p-5 sm:flex-row sm:p-6">
              <RiskGauge score={a.riskScore} verdict={statementVerdict(a.riskScore)} size={160} />
              <div>
                <h2 className="text-sm font-medium tracking-wide text-text-2 uppercase">
                  {t('tx.narrativeTitle')}
                </h2>
                <p className="mt-2 text-base">{a.narrative}</p>
              </div>
            </section>
            <ResultSection title={t('tx.chartTitle')} delayMs={150}>
              <StatementChart analysis={a} selected={current?.id ?? null} onSelect={setSelected} />
            </ResultSection>
            <ResultSection title={t('tx.anomaliesTitle')} delayMs={300}>
              {anomalies.length === 0 ? (
                <p className="text-text-2">{t('tx.noAnomalies')}</p>
              ) : (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
                  <ul className="flex flex-col gap-2" aria-label={t('tx.anomaliesTitle')}>
                    {anomalies.map((x) => (
                      <li key={x.id}>
                        <button
                          type="button"
                          aria-pressed={x.id === current?.id}
                          onClick={() => setSelected(x.id)}
                          className={`w-full rounded-chip border px-3 py-2.5 text-left text-sm transition-colors outline-none focus-visible:outline-2 focus-visible:outline-brand ${x.id === current?.id ? 'border-brand/50 bg-brand/10' : 'border-glass-border hover:bg-overlay/5'}`}
                        >
                          <span className="font-medium">{x.title}</span>
                          <span className="block text-xs text-text-2">
                            {t(`severity.${x.severity}`)}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  {current && <AnomalyCard anomaly={current} txns={a.txns} />}
                </div>
              )}
            </ResultSection>
            <ResultSection title={t('tx.summaryTitle')} delayMs={400}>
              <SpendingSummary summary={a.summary} />
            </ResultSection>
          </div>
        </RevealProvider>
      )}
    </m.section>
  );
}
