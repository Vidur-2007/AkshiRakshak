import { AtSign, TriangleAlert } from 'lucide-react';
import { m } from 'motion/react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ResultSection } from '@/components/analysis/InlineResult';
import { REVEAL_MS, useRevealTransition } from '@/components/analysis/reveal';
import { escalationIndex, toBubble } from '@/lib/chatLines';
import type { AnalysisResult, ChatTurnRisk } from '@/lib/engine';
import { parseEmailHeaders } from '@/lib/emailHeaders';
import { riskTone, TONE_COLOR } from '@/lib/risk';
import { cn } from '@/lib/utils';

/** Bubbles (them left, me right) with each message's risk as a coloured edge (§5.5). */
export function ChatThreadView({ turns }: { turns: ChatTurnRisk[] }) {
  const { t } = useTranslation();
  const tr = useRevealTransition();
  const bubbles = useMemo(() => turns.map(toBubble), [turns]);
  const esc = escalationIndex(turns.map((x) => x.risk));
  return (
    <ol className="flex flex-col gap-2.5">
      {bubbles.map((b, i) => {
        const mine = b.sender === 'me';
        const color = TONE_COLOR[riskTone(b.risk)];
        return (
          <m.li
            key={b.index}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={tr(150 + Math.min(i, 20) * 40, 0.3)}
            className={cn('flex flex-col', mine ? 'items-end' : 'items-start')}
          >
            {esc === i && (
              <span className="mb-1.5 inline-flex items-center gap-1.5 self-center rounded-full border border-risk-warn/40 bg-risk-warn/10 px-2.5 py-0.5 text-xs text-text">
                <TriangleAlert className="size-3.5 text-risk-warn" aria-hidden />
                {t('messages.escalation')}
              </span>
            )}
            <div
              className={cn(
                'relative max-w-[85%] rounded-card px-3.5 py-2.5 text-[0.95rem] break-words whitespace-pre-wrap',
                mine
                  ? 'rounded-br-md border-r-4 bg-brand/10'
                  : 'rounded-bl-md border-l-4 bg-surface-2',
              )}
              style={mine ? { borderRightColor: color } : { borderLeftColor: color }}
            >
              {(b.name || b.time) && (
                <p className="mb-0.5 text-xs text-text-2">
                  {b.name}
                  {b.name && b.time ? ' · ' : ''}
                  {b.time}
                </p>
              )}
              {b.body}
              <span className="sr-only"> ({t('analysis.riskOf', { risk: b.risk })})</span>
            </div>
          </m.li>
        );
      })}
    </ol>
  );
}

const W = 320;
const H = 120;
const PAD = { l: 26, r: 10, t: 10, b: 20 };

export function riskLinePoints(risks: number[]): { x: number; y: number }[] {
  const n = risks.length;
  const iw = W - PAD.l - PAD.r;
  const ih = H - PAD.t - PAD.b;
  return risks.map((r, i) => ({
    x: PAD.l + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw),
    y: PAD.t + ih * (1 - Math.max(0, Math.min(100, r)) / 100),
  }));
}

/** Risk of each chat message in order, with the escalation point marked (§5.5). */
export function RiskLine({ turns }: { turns: ChatTurnRisk[] }) {
  const { t } = useTranslation();
  const tr = useRevealTransition();
  const risks = turns.map((x) => x.risk);
  const pts = riskLinePoints(risks);
  const esc = escalationIndex(risks);
  const y = (v: number) => PAD.t + (H - PAD.t - PAD.b) * (1 - v / 100);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  return (
    <figure>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={t('messages.riskLineLabel')}
      >
        {[40, 70].map((v) => (
          <g key={v}>
            <line
              x1={PAD.l}
              x2={W - PAD.r}
              y1={y(v)}
              y2={y(v)}
              stroke="var(--text-2)"
              strokeOpacity={0.3}
              strokeDasharray="3 4"
            />
            <text
              x={PAD.l - 6}
              y={y(v) + 3}
              textAnchor="end"
              fontSize="9"
              fill="var(--text-2)"
              className="font-mono"
            >
              {v}
            </text>
          </g>
        ))}
        {esc !== null && pts[esc] && (
          <line
            x1={pts[esc].x}
            x2={pts[esc].x}
            y1={PAD.t}
            y2={H - PAD.b}
            stroke="var(--risk-warn)"
            strokeOpacity={0.6}
            strokeWidth={1.5}
          />
        )}
        {pts.length > 1 && (
          <m.path
            d={d}
            fill="none"
            stroke="var(--text-2)"
            strokeWidth={2}
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={tr(300, 0.8)}
          />
        )}
        {pts.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={4}
            fill={TONE_COLOR[riskTone(risks[i] ?? 0)]}
            stroke="var(--surface)"
            strokeWidth={1.5}
          />
        ))}
        {pts.map((p, i) =>
          pts.length <= 12 || i % Math.ceil(pts.length / 12) === 0 ? (
            <text
              key={`l${i}`}
              x={p.x}
              y={H - 6}
              textAnchor="middle"
              fontSize="9"
              fill="var(--text-2)"
              className="font-mono"
            >
              {i + 1}
            </text>
          ) : null,
        )}
      </svg>
      <ul className="sr-only">
        {risks.map((r, i) => (
          <li key={i}>
            {t('messages.messageN', { n: i + 1 })}: {t('analysis.riskOf', { risk: r })}
          </li>
        ))}
      </ul>
    </figure>
  );
}

/** From / Reply-To / Subject, with a Reply-To on another domain highlighted (§5.5). */
export function EmailHeaderCard({ text }: { text: string }) {
  const { t } = useTranslation();
  const h = parseEmailHeaders(text);
  if (!h.from && !h.replyTo && !h.subject) return null;
  const row = (label: string, value: string | null, alert = false) =>
    value ? (
      <div
        className={cn(
          'grid grid-cols-[6rem_minmax(0,1fr)] gap-3 border-t border-glass-border py-2.5 first:border-t-0',
          alert && 'rounded-chip bg-risk-scam/10 px-2',
        )}
      >
        <dt className="text-sm text-text-2">{label}</dt>
        <dd className="font-mono text-sm break-all">{value}</dd>
      </div>
    ) : null;
  return (
    <div className="flex flex-col gap-3">
      <dl>
        {row(
          t('messages.from'),
          h.from ? `${h.from.name ? `${h.from.name} ` : ''}<${h.from.address}>` : null,
        )}
        {row(t('messages.replyTo'), h.replyTo?.address ?? null, h.replyToMismatch)}
        {row(t('messages.subject'), h.subject)}
      </dl>
      {h.replyToMismatch && h.replyTo && (
        <p className="flex items-start gap-2 text-sm text-text">
          <AtSign className="mt-0.5 size-4 shrink-0 text-risk-scam" aria-hidden />
          {t('messages.replyMismatch', { domain: h.replyTo.domain })}
        </p>
      )}
    </div>
  );
}

/**
 * Risk line and chat thread for a chat result (also used on /scan/:id). The email
 * header card needs the raw text (analysis text is normalised, without line breaks),
 * so it only appears on this page.
 */
export function ChatExtras({ result }: { result: AnalysisResult }) {
  const { t } = useTranslation();
  if (!result.chat?.length) return null;
  return (
    <>
      <ResultSection title={t('messages.riskLineTitle')} delayMs={REVEAL_MS.verdict + 200}>
        <RiskLine turns={result.chat} />
      </ResultSection>
      <ResultSection title={t('messages.threadTitle')} delayMs={REVEAL_MS.verdict + 260}>
        <ChatThreadView turns={result.chat} />
      </ResultSection>
    </>
  );
}
