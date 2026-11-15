import {
  Ban,
  ClipboardCopy,
  ExternalLink,
  Flag,
  Phone,
  ShieldX,
  Siren,
  type LucideIcon,
} from 'lucide-react';
import { m } from 'motion/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { buttonVariants } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { addToBlocklist } from '@/lib/db';
import { actionText, categoryText, type ActionId, type AnalysisResult } from '@/lib/engine';
import { blockableValues, buildEvidenceText, type EvidenceLabels } from '@/lib/evidence';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { AnalysisShareCard, ShareImageButton } from '@/components/share/ShareCards';
import { REVEAL_MS, useRevealTransition } from './reveal';

type SheetKind = { kind: 'action'; id: ActionId } | { kind: 'reject' } | { kind: 'report' } | null;

const EVIDENCE_KEYS: (keyof EvidenceLabels)[] = [
  'heading',
  'date',
  'channel',
  'verdict',
  'risk',
  'category',
  'reasons',
  'links',
  'upi',
  'phones',
  'emails',
  'amounts',
  'message',
];

export function useEvidence(result: AnalysisResult): string {
  const { t } = useTranslation();
  const lang = useAppStore((s) => s.lang);
  const labels = Object.fromEntries(
    EVIDENCE_KEYS.map((k) => [k, t(`evidence.${k}`)]),
  ) as unknown as EvidenceLabels;
  return buildEvidenceText({
    result,
    labels,
    verdictText: t(`verdict.${result.verdict}`),
    categoryName: result.category ? categoryText(result.category, lang).name : null,
    formatDate: (iso) => new Date(iso).toLocaleString(lang === 'en' ? 'en-IN' : `${lang}-IN`),
  });
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

const ACTION_ICON: Partial<Record<ActionId, LucideIcon>> = {
  decline_request: Ban,
  block_sender: Ban,
  do_not_click: ShieldX,
  do_not_pay: ShieldX,
  do_not_share_otp: ShieldX,
  do_not_install: ShieldX,
  end_call: Phone,
  report_1930: Phone,
  call_bank: Phone,
  emergency: Siren,
};

const dockBtn =
  'inline-flex min-h-tap shrink-0 items-center gap-2 rounded-chip border border-glass-border bg-surface-2 px-3.5 text-sm font-medium text-text transition-colors duration-150 hover:border-brand/40 hover:bg-surface outline-none focus-visible:outline-2 focus-visible:outline-brand';

function ActionHref({ href, label }: { href: string; label: string }) {
  if (href.startsWith('/')) {
    return (
      <Link to={href} className={buttonVariants({ size: 'lg' })}>
        {label}
      </Link>
    );
  }
  const external = /^https?:/.test(href);
  return (
    <a
      href={href}
      className={buttonVariants({ size: 'lg' })}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      {href.startsWith('tel:') ? <Phone aria-hidden /> : <ExternalLink aria-hidden />}
      {label}
    </a>
  );
}

function RejectSheetBody({ result }: { result: AnalysisResult }) {
  const { t } = useTranslation();
  const values = blockableValues(result);
  const [picked, setPicked] = useState<Set<string>>(() => new Set(values.map((v) => v.value)));
  const [saved, setSaved] = useState(false);
  const save = async () => {
    try {
      for (const v of values) if (picked.has(v.value)) await addToBlocklist(v.value, v.type);
      setSaved(true);
      toast(t('analysis.blocklistAdded'));
    } catch {
      toast(t('scan.error'));
    }
  };
  return (
    <>
      <p className="rounded-card border border-glass-border bg-surface p-4 text-base">
        {t('analysis.rejectSteps')}
      </p>
      <p className="text-sm text-text-2">{t('analysis.rejectNote')}</p>
      <div>
        <h3 className="font-medium">{t('analysis.blocklistTitle')}</h3>
        <p className="mt-1 text-sm text-text-2">{t('analysis.blocklistHint')}</p>
        {values.length === 0 ? (
          <p className="mt-3 text-sm text-text-2">{t('analysis.blocklistNone')}</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-1">
            {values.map((v) => (
              <li key={v.value}>
                <label className="flex min-h-tap cursor-pointer items-center gap-3 rounded-chip px-2 hover:bg-white/5">
                  <input
                    type="checkbox"
                    className="size-4.5 accent-[var(--brand)]"
                    checked={picked.has(v.value)}
                    disabled={saved}
                    onChange={(e) => {
                      const next = new Set(picked);
                      if (e.target.checked) next.add(v.value);
                      else next.delete(v.value);
                      setPicked(next);
                    }}
                  />
                  <span className="truncate font-mono text-sm">{v.value}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>
      {values.length > 0 && (
        <button
          type="button"
          disabled={saved || picked.size === 0}
          onClick={() => void save()}
          className={buttonVariants({ size: 'lg', className: 'self-start' })}
        >
          <Ban aria-hidden />
          {saved ? t('analysis.blocklistAdded') : t('analysis.blocklistAdd')}
        </button>
      )}
    </>
  );
}

function ReportSheetBody({ evidence }: { evidence: string }) {
  const { t } = useTranslation();
  const rows = [
    {
      href: 'tel:1930',
      title: t('analysis.report1930'),
      body: t('analysis.report1930Body'),
      icon: Phone,
    },
    {
      href: 'https://cybercrime.gov.in',
      title: t('analysis.reportPortal'),
      body: t('analysis.reportPortalBody'),
      icon: ExternalLink,
    },
    {
      href: 'https://sancharsaathi.gov.in',
      title: t('analysis.reportChakshu'),
      body: t('analysis.reportChakshuBody'),
      icon: ExternalLink,
    },
  ];
  return (
    <>
      <ul className="flex flex-col gap-2">
        {rows.map((r) => (
          <li key={r.href}>
            <a
              href={r.href}
              {...(r.href.startsWith('http')
                ? { target: '_blank', rel: 'noopener noreferrer' }
                : {})}
              className="flex min-h-tap items-start gap-3 rounded-card border border-glass-border bg-surface p-4 transition-colors hover:border-brand/40 outline-none focus-visible:outline-2 focus-visible:outline-brand"
            >
              <r.icon className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden />
              <span>
                <span className="block font-medium">{r.title}</span>
                <span className="mt-0.5 block text-sm text-text-2">{r.body}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
      <div>
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-medium">{t('analysis.evidenceTitle')}</h3>
          <button
            type="button"
            onClick={() =>
              void copyText(evidence).then((ok) =>
                toast(ok ? t('analysis.copied') : t('analysis.copyFailed')),
              )
            }
            className={dockBtn}
          >
            <ClipboardCopy className="size-4" aria-hidden />
            {t('analysis.copyEvidence')}
          </button>
        </div>
        <pre className="mt-3 max-h-56 overflow-auto rounded-card border border-glass-border bg-surface p-3 font-mono text-xs whitespace-pre-wrap text-text-2 select-all">
          {evidence}
        </pre>
      </div>
    </>
  );
}

/**
 * The first actions from result.actions plus Reject/Block, Report, Copy evidence,
 * Warn family and SOS (§5.3). Fixed to the bottom on mobile, inline on desktop.
 */
export function ActionDock({ result }: { result: AnalysisResult }) {
  const { t } = useTranslation();
  const lang = useAppStore((s) => s.lang);
  const tr = useRevealTransition();
  const [sheet, setSheet] = useState<SheetKind>(null);
  const evidence = useEvidence(result);
  const primary = result.actions.filter((a) => a !== 'no_action_needed').slice(0, 2);
  const canBlock = blockableValues(result).length > 0;
  const risky = result.verdict !== 'no_signs';

  const warnFamily = async () => {
    const flags = result.signals
      .filter((s) => s.weight > 0)
      .slice(0, 2)
      .map((s) => s.label)
      .join(', ');
    const first = result.actions[0];
    const text = t('analysis.warnText', {
      verdict: t(`verdict.${result.verdict}`),
      category: result.category
        ? categoryText(result.category, lang).name
        : t(`kind.${result.kind}`),
      flags: flags || '—',
      advice: first ? actionText(first, lang).label + '.' : '',
    });
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ text });
        return;
      } catch {
        /* cancelled or unsupported; fall back to copying */
      }
    }
    toast((await copyText(text)) ? t('analysis.warnCopied') : t('analysis.copyFailed'));
  };

  const action = sheet?.kind === 'action' ? actionText(sheet.id, lang) : null;

  return (
    <>
      <m.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={tr(REVEAL_MS.dock, 0.45)}
        className={cn(
          // mobile: fixed above the tab bar, solid (header and tab bar already use the
          // two blurred layers §7 allows); desktop: inline card
          'fixed inset-x-0 bottom-[calc(var(--tabbar-h)+env(safe-area-inset-bottom))] z-30 border-t border-glass-border bg-surface/95 px-3 py-2.5',
          'lg:static lg:z-auto lg:rounded-card lg:border lg:bg-surface lg:p-4',
        )}
      >
        <h2 className="sr-only lg:not-sr-only lg:mb-3 lg:text-sm lg:font-medium lg:text-text-2">
          {t('analysis.actionsTitle')}
        </h2>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] lg:flex-wrap lg:overflow-visible">
          {primary.map((id) => {
            const Icon = ACTION_ICON[id] ?? ShieldX;
            const { label } = actionText(id, lang);
            return id === 'emergency' ? (
              <Link key={id} to="/sos" className={cn(dockBtn, 'border-risk-scam/50')}>
                <Icon className="size-4 text-risk-scam" aria-hidden />
                {label}
              </Link>
            ) : (
              <button
                key={id}
                type="button"
                onClick={() => setSheet({ kind: 'action', id })}
                className={dockBtn}
              >
                <Icon className="size-4 text-brand" aria-hidden />
                {label}
              </button>
            );
          })}
          {canBlock && risky && (
            <button type="button" onClick={() => setSheet({ kind: 'reject' })} className={dockBtn}>
              <Ban className="size-4 text-brand" aria-hidden />
              {t('analysis.reject')}
            </button>
          )}
          {risky && (
            <button type="button" onClick={() => setSheet({ kind: 'report' })} className={dockBtn}>
              <Flag className="size-4 text-brand" aria-hidden />
              {t('analysis.report')}
            </button>
          )}
          <button
            type="button"
            onClick={() =>
              void copyText(evidence).then((ok) =>
                toast(ok ? t('analysis.copied') : t('analysis.copyFailed')),
              )
            }
            className={dockBtn}
          >
            <ClipboardCopy className="size-4 text-brand" aria-hidden />
            {t('analysis.copyEvidence')}
          </button>
          {risky && (
            // Warn family = the share card image (M7.2); the text warning is the fallback
            <ShareImageButton
              card={<AnalysisShareCard result={result} lang={lang} />}
              filename={`akshi-warning-${result.id.slice(0, 8)}.png`}
              text={t('analysis.warnFamily')}
              label={t('analysis.warnFamily')}
              className={cn(dockBtn, 'border-glass-border bg-surface-2')}
              onFallback={() => void warnFamily()}
            />
          )}
          {risky && (
            <Link to="/sos" className={cn(dockBtn, 'border-risk-scam/50 text-text')}>
              <Siren className="size-4 text-risk-scam" aria-hidden />
              {t('analysis.sos')}
            </Link>
          )}
        </div>
      </m.div>

      <Sheet open={sheet !== null} onOpenChange={(o) => !o && setSheet(null)}>
        <SheetContent
          side="bottom"
          closeLabel={t('shell.close')}
          className="mx-auto max-w-xl sm:mb-6 sm:rounded-sheet sm:border"
        >
          {sheet?.kind === 'action' && action && (
            <>
              <SheetTitle className="pr-10">{action.label}</SheetTitle>
              <SheetDescription className="text-base text-text">{action.body}</SheetDescription>
              {action.href && <ActionHref href={action.href} label={t('analysis.openAction')} />}
            </>
          )}
          {sheet?.kind === 'reject' && (
            <>
              <SheetTitle className="pr-10">{t('analysis.rejectTitle')}</SheetTitle>
              <SheetDescription className="sr-only">{t('analysis.rejectSteps')}</SheetDescription>
              <RejectSheetBody result={result} />
            </>
          )}
          {sheet?.kind === 'report' && (
            <>
              <SheetTitle className="pr-10">{t('analysis.reportTitle')}</SheetTitle>
              <SheetDescription className="sr-only">
                {t('analysis.report1930Body')}
              </SheetDescription>
              <ReportSheetBody evidence={evidence} />
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

/** "What to do now" (M1.6): every action with its explanation, in order of importance. */
export function WhatToDo({ result }: { result: AnalysisResult }) {
  const lang = useAppStore((s) => s.lang);
  return (
    <ol className="flex flex-col gap-3">
      {result.actions.map((id, i) => {
        const a = actionText(id, lang);
        const Icon = ACTION_ICON[id] ?? ShieldX;
        return (
          <li key={id} className="flex items-start gap-3">
            <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-brand/12 font-mono text-xs text-brand">
              {id === 'no_action_needed' ? <Icon className="size-3.5" aria-hidden /> : i + 1}
            </span>
            <div className="min-w-0">
              <p className="font-medium">
                {a.href && /^(tel:|https?:)/.test(a.href) ? (
                  <a
                    href={a.href}
                    className="underline decoration-brand/50 underline-offset-4 hover:decoration-brand"
                    {...(a.href.startsWith('http')
                      ? { target: '_blank', rel: 'noopener noreferrer' }
                      : {})}
                  >
                    {a.label}
                  </a>
                ) : (
                  a.label
                )}
              </p>
              <p className="mt-0.5 text-sm text-text-2">{a.body}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
