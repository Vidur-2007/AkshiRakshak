// POST /api/telegram — webhook for the Akshi Telegram bot (added 2026-11-21).
// People forward a suspicious message to the bot and get the verdict, the reasons and what to do,
// in the language of the message. The same on-device engine as /api/analyze: no AI call, no link
// expansion, no domain lookup.
//
// Security and privacy:
// - Telegram sends the secret we gave setWebhook in X-Telegram-Bot-Api-Secret-Token; anything
//   else is refused. With TELEGRAM_WEBHOOK_SECRET unset the endpoint is switched off (503).
// - The reply is the webhook's own response (Telegram performs the sendMessage), so this server
//   never calls Telegram and never needs the bot token. The token stays with the person who runs
//   scripts/telegram-setup.ts.
// - Private chats only. 20 checks a minute per chat. Logs carry no text and no chat id.
import { timingSafeEqual } from 'node:crypto';
import type { Lang } from '@akshi/contracts';
import { analyze } from '@akshi/engine';
import { apiError, json, logEvent, readJson } from './_lib/http.js';
import { checkRate } from './_lib/ratelimit.js';
import {
  BOT,
  formatResult,
  readUpdate,
  replyLang,
  sendMessage,
  UpdateSchema,
} from './_lib/telegram.js';

/** Telegram text messages are at most 4096 characters; captions 1024. */
const MAX_TEXT = 4096;

function secretMatches(request: Request, expected: string): boolean {
  const got = Buffer.from(request.headers.get('x-telegram-bot-api-secret-token') ?? '');
  const want = Buffer.from(expected);
  return got.length === want.length && timingSafeEqual(got, want);
}

/** 200 with no body: Telegram treats the update as handled and sends nothing. */
const handled = () => new Response(null, { status: 200 });

async function check(text: string, app: Lang) {
  const run = (lang: Lang) =>
    analyze({
      kind: 'message',
      text: text.slice(0, MAX_TEXT),
      lang,
      options: { cloudAI: false, expandLinks: false, domainAge: false },
    });
  const first = await run(app);
  const lang = replyLang(first.detectedLang, app);
  return { result: lang === app ? first : await run(lang), lang };
}

export async function POST(request: Request): Promise<Response> {
  const t0 = Date.now();
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) {
    return apiError(503, 'upstream_unavailable', 'The Telegram bot is not set up on this server');
  }
  if (!secretMatches(request, secret)) return apiError(401, 'bad_request', 'Unknown sender');

  let update;
  try {
    update = UpdateSchema.safeParse(await readJson(request, 64_000));
  } catch {
    return handled(); // not an update we can read; answering 200 stops Telegram retrying it
  }
  if (!update.success) return handled();
  const incoming = readUpdate(update.data);
  if (incoming.kind === 'ignore') return handled();

  const { chatId, messageId, lang } = incoming;
  const site = new URL(request.url).origin;
  const reply = (text: string) => json(sendMessage(chatId, messageId, text));

  if (!checkRate('telegram', `chat:${chatId}`).ok) return reply(BOT[lang].limited);
  switch (incoming.kind) {
    case 'command':
      logEvent('telegram', { status: 200, kind: incoming.command });
      return reply(BOT[lang].welcome);
    case 'photo':
      logEvent('telegram', { status: 200, kind: 'photo' });
      return reply(`${BOT[lang].photo}\n${site}/scan`);
    case 'empty':
      return reply(BOT[lang].empty);
    case 'text':
      try {
        const { result, lang: used } = await check(incoming.text, lang);
        logEvent('telegram', {
          status: 200,
          kind: 'check',
          verdict: result.verdict,
          lang: used,
          ms: Date.now() - t0,
        });
        return reply(formatResult(result, used, site));
      } catch {
        logEvent('telegram', { status: 500, kind: 'check', ms: Date.now() - t0 });
        return reply(BOT[lang].failed);
      }
  }
}
