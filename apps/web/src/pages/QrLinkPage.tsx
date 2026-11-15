import { FlaskConical, QrCode, ScanSearch } from 'lucide-react';
import { m } from 'motion/react';
import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { InlineResult, ResultSection } from '@/components/analysis/InlineResult';
import { REVEAL_MS } from '@/components/analysis/reveal';
import { DomainAgeBadge, RedirectHops } from '@/components/modules/LinkExtras';
import { QRScannerSheet } from '@/components/modules/QRScannerSheet';
import { QRXray } from '@/components/modules/QRXray';
import { URLAnatomy } from '@/components/modules/URLAnatomy';
import { StageTicker } from '@/components/scan/StageTicker';
import { useAnalysis } from '@/components/scan/useScan';
import { buttonVariants } from '@/components/ui/button';
import { usePageTitle } from '@/hooks/usePageTitle';
import {
  detectInputKind,
  inspectUrl,
  parseUpiUri,
  type UpiPayload,
  type UrlFinding,
} from '@/lib/engine';
import { fadeUp, stagger } from '@/lib/motion';
import type { RequestCore } from '@/lib/scan';
import { QR_LINK_SAMPLES } from '@/lib/qrSamples';
import { TEXT_STAGES } from '@/lib/scanTiming';
import { useAppStore } from '@/lib/store';

const SAMPLES = QR_LINK_SAMPLES;

type Source = 'typed' | 'qr';

/** What to send to analyze for a value typed or decoded from a QR. */
export function requestFor(
  value: string,
  source: Source,
): { core: RequestCore; url: string | null } {
  const v = value.trim();
  if (/^upi:/i.test(v) || source === 'qr') {
    const url = /^https?:\/\//i.test(v) ? v : null;
    return { core: { kind: 'qr', qrPayload: v, text: v }, url };
  }
  const kind = detectInputKind(v).kind;
  if (kind === 'upi_id') return { core: { kind: 'upi_id', upiId: v, text: v }, url: null };
  if (kind === 'url') return { core: { kind: 'url', url: v, text: v }, url: v };
  return { core: { kind: 'message', text: v }, url: null };
}

export default function QrLinkPage() {
  const { t } = useTranslation();
  usePageTitle(t('page.qrLink.title'));
  const [params] = useSearchParams();
  const inputId = useId();
  const online = useAppStore((s) => s.online);
  const [value, setValue] = useState(params.get('value') ?? '');
  const [scanOpen, setScanOpen] = useState(false);
  const [payload, setPayload] = useState<UpiPayload | null>(null);
  const [finding, setFinding] = useState<UrlFinding | null>(null);
  const { run, busy, failed, ticker, result } = useAnalysis();
  const ran = useRef(false);

  const check = useCallback(
    async (raw: string, source: Source) => {
      const v = raw.trim();
      if (!v) return;
      const { core, url } = requestFor(v, source);
      setPayload(core.kind === 'qr' ? parseUpiUri(v) : null);
      setFinding(null);
      const [r, f] = await Promise.all([
        run(core),
        url
          ? inspectUrl(url, { expand: online, domainAge: online }).catch(() => null)
          : Promise.resolve(null),
      ]);
      // Prefer the engine's own finding from the analysis when it carries network extras
      const fromResult = r?.entities.urls[0];
      setFinding(
        fromResult && (fromResult.expanded || fromResult.domainAge)
          ? fromResult
          : (f ?? fromResult ?? null),
      );
      if (r?.qr) setPayload(r.qr);
    },
    [run, online],
  );

  // Entity chips link here with ?value=
  useEffect(() => {
    const v = params.get('value');
    if (v && !ran.current) {
      ran.current = true;
      void check(v, 'typed');
    }
  }, [params, check]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void check(value, 'typed');
  };

  const before = (
    <>
      {payload && (
        <ResultSection title={t('xray.title')} delayMs={REVEAL_MS.verdict + 200} tourId="qr-xray">
          <QRXray payload={payload} />
        </ResultSection>
      )}
      {finding && (
        <ResultSection title={t('anatomy.title')} delayMs={REVEAL_MS.verdict + 260}>
          <div className="flex flex-col gap-4">
            {finding.domainAge && (
              <div>
                <DomainAgeBadge age={finding.domainAge} />
              </div>
            )}
            <URLAnatomy finding={finding} />
          </div>
        </ResultSection>
      )}
      {finding?.expanded && finding.expanded.hops.length > 0 && (
        <ResultSection title={t('redirect.title')} delayMs={REVEAL_MS.verdict + 320}>
          <RedirectHops chain={finding.expanded} />
        </ResultSection>
      )}
    </>
  );

  return (
    <m.section
      variants={stagger(0.06)}
      initial="hidden"
      animate="show"
      aria-labelledby="page-title"
      className="mx-auto w-full max-w-3xl px-4 pt-8 sm:px-6 lg:pt-12"
    >
      <m.h1
        variants={fadeUp}
        id="page-title"
        className="text-xl font-semibold tracking-tight sm:text-2xl"
      >
        {t('page.qrLink.title')}
      </m.h1>
      <m.p variants={fadeUp} className="mt-2 text-text-2">
        {t('page.qrLink.body')}
      </m.p>

      <m.form variants={fadeUp} onSubmit={submit} className="glass mt-6 rounded-sheet p-3 sm:p-4">
        <label htmlFor={inputId} className="px-1 text-sm font-medium text-text-2">
          {t('qrLink.inputLabel')}
        </label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            id={inputId}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={t('qrLink.placeholder')}
            inputMode="url"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            maxLength={4000}
            className="min-h-12 min-w-0 flex-1 rounded-card bg-surface/80 px-3 font-mono text-sm text-text outline-none placeholder:font-sans placeholder:text-text-2/70 focus-visible:outline-2 focus-visible:outline-brand"
          />
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => setScanOpen(true)}
              className={buttonVariants({ variant: 'outline', size: 'lg', className: 'flex-1' })}
            >
              <QrCode aria-hidden />
              {t('scan.scanQr')}
            </button>
            <button
              type="submit"
              disabled={!value.trim() || busy}
              className={buttonVariants({ size: 'lg', className: 'flex-1' })}
            >
              <ScanSearch aria-hidden />
              {t('qrLink.check')}
            </button>
          </div>
        </div>
      </m.form>

      <m.div variants={fadeUp} className="mt-4 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full border border-glass-border px-2 py-0.5 text-xs text-text-2">
          <FlaskConical className="size-3" aria-hidden />
          {t('placeholder.sampleData')}
        </span>
        {SAMPLES.map((s) => (
          <button
            key={s.key}
            type="button"
            disabled={busy}
            onClick={() => {
              setValue(s.value);
              void check(s.value, 'typed');
            }}
            className="min-h-10 rounded-chip border border-glass-border bg-surface px-3.5 text-sm text-text transition-colors hover:border-brand/40 disabled:opacity-50 outline-none focus-visible:outline-2 focus-visible:outline-brand"
          >
            {t(`qrLink.samples.${s.key}`)}
          </button>
        ))}
      </m.div>

      <div className="min-h-10 px-1 pt-4" aria-live="polite">
        {busy && <StageTicker state={ticker} stages={TEXT_STAGES} />}
        {failed && !busy && (
          <p role="alert" className="text-sm">
            {t('scan.error')}
          </p>
        )}
      </div>

      <div className="mt-2">
        {result && !busy ? (
          <InlineResult result={result} before={before} />
        ) : (
          !busy && (
            <div className="surface flex flex-col items-center gap-2 p-8 text-center">
              <QrCode className="size-8 text-text-2" aria-hidden />
              <p className="font-medium">{t('qrLink.emptyTitle')}</p>
              <p className="max-w-md text-sm text-text-2">{t('qrLink.emptyBody')}</p>
            </div>
          )
        )}
      </div>

      <QRScannerSheet
        open={scanOpen}
        onOpenChange={setScanOpen}
        onDecoded={(p) => {
          setValue(p);
          void check(p, 'qr');
        }}
      />
    </m.section>
  );
}
