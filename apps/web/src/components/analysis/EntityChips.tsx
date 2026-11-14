import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import type { Entities } from '@/lib/engine';
import { riskTone, TONE_COLOR } from '@/lib/risk';

function RiskDot({ risk }: { risk: number }) {
  const { t } = useTranslation();
  return (
    <span
      className="size-2 shrink-0 rounded-full"
      style={{ background: TONE_COLOR[riskTone(risk)] }}
      role="img"
      aria-label={t('analysis.riskOf', { risk: Math.round(risk) })}
    />
  );
}

const chip =
  'inline-flex min-h-9 max-w-full items-center gap-2 rounded-chip border border-glass-border bg-surface-2 px-3 font-mono text-sm text-text';

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-medium tracking-wide text-text-2 uppercase">{title}</h3>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function InspectChip({ value, risk }: { value: string; risk: number }) {
  const { t } = useTranslation();
  return (
    <Link
      to={`/modules/qr-link?value=${encodeURIComponent(value)}`}
      aria-label={t('analysis.inspect', { value })}
      className={`${chip} transition-colors duration-150 hover:border-brand/40 outline-none focus-visible:outline-2 focus-visible:outline-brand`}
    >
      <RiskDot risk={risk} />
      <span className="truncate">{value}</span>
      <ChevronRight className="size-3.5 shrink-0 text-text-2" aria-hidden />
    </Link>
  );
}

/** URLs, UPI IDs, phones and amounts in mono, with a risk dot where the engine scored them (M1.5). */
export function EntityChips({ entities }: { entities: Entities }) {
  const { t } = useTranslation();
  const { urls, upiIds, phones, amounts } = entities;
  if (!urls.length && !upiIds.length && !phones.length && !amounts.length) return null;
  return (
    <div className="flex flex-col gap-4">
      {urls.length > 0 && (
        <Group title={t('analysis.links')}>
          {urls.map((u) => (
            <InspectChip key={u.raw} value={u.raw} risk={u.risk} />
          ))}
        </Group>
      )}
      {upiIds.length > 0 && (
        <Group title={t('analysis.upiIds')}>
          {upiIds.map((u) => (
            <InspectChip key={u.raw} value={u.raw} risk={u.risk} />
          ))}
        </Group>
      )}
      {phones.length > 0 && (
        <Group title={t('analysis.phones')}>
          {phones.map((p) => (
            <span key={p.raw} className={chip}>
              {p.indicator && <RiskDot risk={p.indicator.reports >= 3 ? 95 : 60} />}
              {p.raw}
            </span>
          ))}
        </Group>
      )}
      {amounts.length > 0 && (
        <Group title={t('analysis.amounts')}>
          {amounts.map((a, i) => (
            <span key={`${a.raw}-${i}`} className={chip}>
              ₹{a.value.toLocaleString('en-IN')}
            </span>
          ))}
        </Group>
      )}
    </div>
  );
}
