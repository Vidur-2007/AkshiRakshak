/**
 * Ask Akshi (SPEC_A_ENGINE.md §12.4).
 *
 * Offline: BM25 over FAQ (question ×2, answer, tags) in the user's language, with English as a
 * fallback document for every item, so a Hinglish or English question still finds a Hindi answer.
 * The top 3 ids ground the online answer; offline the best FAQ answer is returned as is.
 * Online (opts.online and the device is online): the masked question and the top-3 ids go to
 * /api/ask, which may only use those answers. Any failure falls back to the offline answer.
 * No match at all → the "not covered" answer pointing to 1930 and cybercrime.gov.in.
 */
import { normalizeText, type AssistantAnswer, type FaqItem, type Lang } from '@akshi/contracts';
import { FAQ } from '@akshi/content';
import { isOnline } from './ai';
import { ensureStrings, template } from './i18n';
import { maskPII } from './mask';
import { postJson } from './net';
import { netSchemas } from './schemas-lazy';

const K1 = 1.2;
const B = 0.75;
const STOP = new Set([
  'a',
  'an',
  'the',
  'is',
  'are',
  'am',
  'i',
  'my',
  'me',
  'to',
  'of',
  'in',
  'on',
  'for',
  'and',
  'or',
  'it',
  'this',
  'that',
  'do',
  'does',
  'did',
  'can',
  'what',
  'how',
  'should',
  'will',
  'be',
  'with',
  'from',
  'by',
  'at',
  'if',
  'you',
  'your',
  'क्या',
  'है',
  'हैं',
  'मैं',
  'मेरा',
  'मुझे',
  'को',
  'का',
  'की',
  'के',
  'में',
  'से',
  'और',
  'कैसे',
  'करें',
  'ఏమి',
  'నా',
  'నేను',
  'ఎలా',
  'కు',
  'లో',
  'మరియు',
  'కి',
  'কি',
  'আমার',
  'আমি',
  'কীভাবে',
  'এবং',
  'কে',
  'এর',
  'করব',
]);

/** Lower-case word tokens; Latin words lose a plural/verb "s" so "codes" matches "code". */
export function tokenize(text: string): string[] {
  return normalizeText(text)
    .toLowerCase()
    .split(/[^\p{L}\p{M}\p{N}]+/u)
    .filter((w) => w.length > 1 && !STOP.has(w))
    .map((w) => (/^[a-z]{3,}s$/.test(w) && !w.endsWith('ss') ? w.slice(0, -1) : w));
}

interface Doc {
  id: string;
  tokens: string[];
  tf: Map<string, number>;
}
interface Index {
  docs: Doc[];
  df: Map<string, number>;
  avgLen: number;
}

function docText(item: FaqItem, lang: Lang): string {
  const q = item.q[lang] ?? item.q.en;
  const a = item.a[lang] ?? item.a.en;
  return `${q} ${q} ${a} ${item.tags.join(' ').replace(/_/g, ' ')}`;
}

function buildIndex(items: readonly FaqItem[], lang: Lang): Index {
  const docs = items.map((item) => {
    const tokens = tokenize(docText(item, lang));
    const tf = new Map<string, number>();
    for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
    return { id: item.id, tokens, tf };
  });
  const df = new Map<string, number>();
  for (const d of docs) for (const t of d.tf.keys()) df.set(t, (df.get(t) ?? 0) + 1);
  const avgLen = docs.reduce((s, d) => s + d.tokens.length, 0) / Math.max(1, docs.length);
  return { docs, df, avgLen };
}

const indexes = new Map<Lang, Index>();
function indexFor(lang: Lang): Index {
  let idx = indexes.get(lang);
  if (!idx) indexes.set(lang, (idx = buildIndex(FAQ, lang)));
  return idx;
}

function bm25(idx: Index, query: string[]): Map<string, number> {
  const scores = new Map<string, number>();
  const n = idx.docs.length;
  for (const d of idx.docs) {
    let s = 0;
    for (const q of new Set(query)) {
      const f = d.tf.get(q);
      if (!f) continue;
      const df = idx.df.get(q) ?? 0;
      const idf = Math.log(1 + (n - df + 0.5) / (df + 0.5));
      s += idf * ((f * (K1 + 1)) / (f + K1 * (1 - B + (B * d.tokens.length) / idx.avgLen)));
    }
    if (s > 0) scores.set(d.id, s);
  }
  return scores;
}

/** FAQ ids ranked for a question (user's language and English, best score per item). */
export function searchFaq(question: string, lang: Lang, k = 3): { id: string; score: number }[] {
  const q = tokenize(question);
  if (!q.length) return [];
  const merged = new Map<string, number>();
  for (const l of new Set<Lang>([lang, 'en'])) {
    for (const [id, s] of bm25(indexFor(l), q)) merged.set(id, Math.max(merged.get(id) ?? 0, s));
  }
  return [...merged]
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

function offlineAnswer(top: { id: string }[], lang: Lang): AssistantAnswer {
  const best = top[0] ? FAQ.find((f) => f.id === top[0]!.id) : undefined;
  if (!best) return { answer: template('faqNotCovered', lang), sources: [], mode: 'offline' };
  return { answer: best.a[lang] ?? best.a.en, sources: [best.id], mode: 'offline' };
}

export async function askAssistant(
  question: string,
  lang: Lang,
  opts?: { online?: boolean; signal?: AbortSignal },
): Promise<AssistantAnswer> {
  await ensureStrings(lang);
  const top = searchFaq(question, lang, 3);
  const offline = offlineAnswer(top, lang);
  if (!opts?.online || !isOnline() || !top.length) return offline;
  const raw = await postJson(
    '/api/ask',
    { question: maskPII(question).masked.slice(0, 1000), lang, faqIds: top.map((t) => t.id) },
    { timeoutMs: 20_000, ...(opts.signal ? { signal: opts.signal } : {}) },
  );
  if (raw === null) return offline;
  const parsed = (await netSchemas()).AssistantAnswerSchema.safeParse(raw);
  return parsed.success && parsed.data.answer.trim() ? { ...parsed.data, mode: 'online' } : offline;
}
