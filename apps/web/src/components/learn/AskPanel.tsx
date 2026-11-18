import { BookOpen, Send, Sparkles } from 'lucide-react';
import { m } from 'motion/react';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { askAssistant, FAQ, type AssistantAnswer } from '@/lib/engine';
import { l10n } from '@/lib/l10n';
import { transition } from '@/lib/motion';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';

interface Turn {
  id: number;
  q: string;
  a: AssistantAnswer | null;
  failed?: boolean;
}

/** Online only with AI opt-in and a connection (§5.13); otherwise the offline FAQ guide. */
export function askOnline(aiOptIn: boolean, online: boolean): boolean {
  return aiOptIn && online;
}

/** Ask Akshi (M11.3): chat over the FAQ, used by /learn/ask and the top-bar slide-over. */
export function AskPanel({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  const lang = useAppStore((s) => s.lang);
  const aiOptIn = useAppStore((s) => s.aiOptIn);
  const online = useAppStore((s) => s.online);
  const inputId = useId();
  const [q, setQ] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => () => abort.current?.abort(), []);
  useEffect(() => endRef.current?.scrollIntoView?.({ block: 'nearest' }), [turns]);

  const ask = async (question: string) => {
    const text = question.trim();
    if (!text || busy) return;
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    const id = Date.now();
    setTurns((ts) => [...ts, { id, q: text, a: null }]);
    setQ('');
    setBusy(true);
    try {
      const a = await askAssistant(text, lang, {
        online: askOnline(aiOptIn, online),
        signal: ctrl.signal,
      });
      setTurns((ts) => ts.map((x) => (x.id === id ? { ...x, a } : x)));
    } catch {
      setTurns((ts) => ts.map((x) => (x.id === id ? { ...x, failed: true } : x)));
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void ask(q);
  };

  return (
    <div className="flex h-full flex-col gap-4">
      {!compact && <p className="text-sm text-text-2">{t('ask.intro')}</p>}
      <div className="flex flex-col gap-3" aria-live="polite">
        {turns.map((turn) => (
          <div key={turn.id} className="flex flex-col gap-2">
            <p className="max-w-[85%] self-end rounded-card rounded-br-md bg-brand/15 px-4 py-2.5">
              <span className="sr-only">{t('ask.you')}: </span>
              {turn.q}
            </p>
            {turn.failed ? (
              <p className="max-w-[90%] self-start rounded-card rounded-bl-md bg-surface-2 px-4 py-3">
                {t('ask.failed')}
              </p>
            ) : turn.a ? (
              <m.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={transition.base}
                className="max-w-[90%] self-start rounded-card rounded-bl-md bg-surface-2 px-4 py-3"
              >
                <span
                  className={cn(
                    'mb-2 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs',
                    turn.a.mode === 'online'
                      ? 'border-ai/50 bg-ai/10 text-text'
                      : 'border-glass-border text-text-2',
                  )}
                >
                  {turn.a.mode === 'online' ? (
                    <Sparkles className="size-3.5 text-ai" aria-hidden />
                  ) : (
                    <BookOpen className="size-3.5" aria-hidden />
                  )}
                  {turn.a.mode === 'online' ? t('ask.aiBadge') : t('ask.offlineBadge')}
                </span>
                <p className="whitespace-pre-wrap">{turn.a.answer}</p>
                {turn.a.sources.length > 0 && (
                  <div className="mt-3 border-t border-glass-border pt-2">
                    <p className="text-xs text-text-2">{t('ask.sources')}</p>
                    <ul className="mt-1 flex flex-col gap-1">
                      {turn.a.sources.map((sid) => {
                        const f = FAQ.find((x) => x.id === sid);
                        if (!f) return null;
                        return (
                          <li key={sid}>
                            <details className="text-sm">
                              <summary className="cursor-pointer text-brand underline-offset-4 hover:underline">
                                {l10n(f.q, lang)}
                              </summary>
                              <p className="mt-1 text-text-2">{l10n(f.a, lang)}</p>
                            </details>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </m.div>
            ) : (
              <p className="self-start text-sm text-text-2">{t('ask.thinking')}</p>
            )}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {turns.length === 0 && (
        <div>
          <p className="mb-2 text-sm font-medium">{t('ask.suggested')}</p>
          <ul className="flex flex-wrap gap-2">
            {FAQ.slice(0, 4).map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => void ask(l10n(f.q, lang))}
                  className="min-h-10 rounded-chip border border-glass-border bg-surface px-3 text-left text-sm hover:border-brand/40 outline-none focus-visible:outline-2 focus-visible:outline-brand"
                >
                  {l10n(f.q, lang)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={submit} className="mt-auto flex gap-2">
        <label htmlFor={inputId} className="sr-only">
          {t('ask.placeholder')}
        </label>
        <input
          id={inputId}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          maxLength={500}
          placeholder={t('ask.placeholder')}
          className="min-h-12 flex-1 rounded-card border border-glass-border bg-surface-2 px-3 text-base text-text outline-none placeholder:text-text-2/70 focus-visible:border-brand"
        />
        <button
          type="submit"
          disabled={!q.trim() || busy}
          aria-label={t('ask.send')}
          className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-card bg-brand text-brand-contrast disabled:opacity-50 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <Send className="size-5" aria-hidden />
        </button>
      </form>
    </div>
  );
}
