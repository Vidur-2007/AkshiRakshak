/**
 * Ask Akshi (SPEC_A_ENGINE.md §12.4). P1: offline keyword overlap over FAQ.
 * P4: BM25 over FAQ in the user's language, then /api/ask with masked text when online.
 */
import { normalizeText, type AssistantAnswer, type Lang } from '@akshi/contracts';
import { FAQ } from '@akshi/content';

export async function askAssistant(
  question: string,
  lang: Lang,
  _opts?: { online?: boolean; signal?: AbortSignal },
): Promise<AssistantAnswer> {
  const words = new Set(
    normalizeText(question)
      .toLowerCase()
      .split(/[^\p{L}\p{M}\p{N}]+/u)
      .filter((w) => w.length > 2),
  );
  let best = FAQ[0];
  let bestScore = -1;
  for (const item of FAQ) {
    const hay = `${item.q[lang] ?? ''} ${item.q.en} ${item.tags.join(' ')}`.toLowerCase();
    const score = [...words].filter((w) => hay.includes(w)).length;
    if (score > bestScore) {
      best = item;
      bestScore = score;
    }
  }
  if (!best)
    return {
      answer: 'Call 1930 or visit cybercrime.gov.in for help.',
      sources: [],
      mode: 'offline',
    };
  return { answer: best.a[lang] ?? best.a.en, sources: [best.id], mode: 'offline' };
}
