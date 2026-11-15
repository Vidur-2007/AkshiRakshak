import { BadgeCheck, LockOpen, TriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { UrlFinding } from '@/lib/engine';
import { lookalikeRows, parseUrl, type DiffCell } from '@/lib/urlParts';
import { cn } from '@/lib/utils';

type Part = { key: string; text: string; label: string; className: string };

function DiffRow({ label, cells }: { label: string; cells: DiffCell[] }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-20 shrink-0 text-xs text-text-2">{label}</span>
      <span className="flex flex-wrap font-mono text-base">
        {cells.map((c, i) => (
          <span
            key={i}
            className={cn(
              'inline-grid min-w-[1.15em] place-items-center rounded-[4px] px-[1px]',
              c.diff && 'bg-risk-scam/20 text-risk-scam underline decoration-2 underline-offset-4',
            )}
          >
            {c.char}
          </span>
        ))}
      </span>
    </div>
  );
}

/**
 * The URL split into coloured parts; for lookalikes, a character-by-character row
 * against the official domain (§5.6, M4.4).
 */
export function URLAnatomy({ finding }: { finding: UrlFinding }) {
  const { t } = useTranslation();
  const parts = parseUrl(finding.normalized || finding.raw, finding.registrableDomain);
  if (!parts) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-text-2">{t('anatomy.unreadable')}</p>
        <p className="font-mono text-sm break-all">{finding.raw}</p>
      </div>
    );
  }
  const segs: Part[] = [
    {
      key: 'scheme',
      text: `${parts.scheme}://`,
      label: t('anatomy.scheme'),
      className: 'text-text-2',
    },
    ...(parts.userinfo
      ? [
          {
            key: 'userinfo',
            text: parts.userinfo,
            label: t('anatomy.userinfo'),
            className: 'text-text-2 line-through decoration-risk-scam/70',
          },
        ]
      : []),
    ...(parts.subdomain
      ? [
          {
            key: 'subdomain',
            text: `${parts.subdomain}.`,
            label: t('anatomy.subdomain'),
            className: 'text-text',
          },
        ]
      : []),
    {
      key: 'domain',
      text: parts.domain,
      label: t('anatomy.domain'),
      className: 'font-semibold text-brand',
    },
    ...(parts.port
      ? [
          {
            key: 'port',
            text: `:${parts.port}`,
            label: t('anatomy.port'),
            className: 'text-text-2',
          },
        ]
      : []),
    ...(parts.path || parts.hash
      ? [
          {
            key: 'path',
            text: `${parts.path}${parts.hash}`,
            label: t('anatomy.path'),
            className: 'text-text-2',
          },
        ]
      : []),
    ...(parts.query
      ? [
          {
            key: 'query',
            text: parts.query,
            label: t('anatomy.query'),
            className: 'text-text-2/80',
          },
        ]
      : []),
  ];
  const rows = finding.lookalikeOf
    ? lookalikeRows(finding.lookalikeOf, parts.domain, finding.lookalikeDiff)
    : null;
  const notes: { icon: typeof LockOpen; text: string; tone: 'warn' | 'ok' }[] = [];
  if (parts.userinfo)
    notes.push({ icon: TriangleAlert, text: t('anatomy.userinfoNote'), tone: 'warn' });
  if (parts.isIp) notes.push({ icon: TriangleAlert, text: t('anatomy.ipNote'), tone: 'warn' });
  if (parts.isPunycode)
    notes.push({ icon: TriangleAlert, text: t('anatomy.punycodeNote'), tone: 'warn' });
  if (parts.scheme === 'http')
    notes.push({ icon: LockOpen, text: t('anatomy.insecure'), tone: 'warn' });
  if (finding.isOfficial)
    notes.push({ icon: BadgeCheck, text: t('anatomy.officialNote'), tone: 'ok' });

  return (
    <div className="flex flex-col gap-5">
      <div className="overflow-x-auto rounded-card border border-glass-border bg-surface p-4">
        <p className="flex flex-wrap items-end gap-x-1.5 gap-y-3 font-mono text-[0.95rem] break-all">
          {segs.map((s) => (
            <span key={s.key} className="inline-flex flex-col">
              <span className={s.className}>{s.text}</span>
              <span className="mt-1 border-t border-glass-border pt-1 font-sans text-[0.7rem] tracking-wide text-text-2 uppercase">
                {s.label}
              </span>
            </span>
          ))}
        </p>
      </div>
      {rows && finding.lookalikeOf && (
        <div className="flex flex-col gap-2 rounded-card border border-risk-scam/30 bg-risk-scam/5 p-4">
          <p className="text-sm font-medium text-text">
            {t('anatomy.lookalikeOf', { domain: finding.lookalikeOf })}
          </p>
          <DiffRow
            label={t('anatomy.official')}
            cells={rows.official.map((c) => ({ ...c, diff: false }))}
          />
          <DiffRow label={t('anatomy.thisLink')} cells={rows.actual} />
        </div>
      )}
      {notes.length > 0 && (
        <ul className="flex flex-col gap-2">
          {notes.map((n) => (
            <li key={n.text} className="flex items-start gap-2 text-sm text-text">
              <n.icon
                className={cn(
                  'mt-0.5 size-4 shrink-0',
                  n.tone === 'warn' ? 'text-risk-warn' : 'text-risk-safe',
                )}
                aria-hidden
              />
              {n.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
