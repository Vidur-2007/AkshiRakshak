/**
 * POST /api/telegram — the Telegram bot webhook: secret check, replies as the webhook response
 * (no outbound call), language choice, commands, photos, groups and the per-chat limit.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as telegram } from '../telegram.js';
import { resetRateLimits } from '../_lib/ratelimit.js';
import { appLang, BOT, escapeHtml, replyLang } from '../_lib/telegram.js';

const SECRET = 'test-secret-0123456789';
const KYC =
  'Dear Customer, your SBI account will be BLOCKED today due to pending KYC. Update KYC immediately at http://sbi-kyc-update.xyz/verify and share the OTP you receive.';
const TE_JOB =
  'హలో! ఇంటి నుండే పార్ట్ టైమ్ జాబ్. యూట్యూబ్ వీడియోలకు లైక్ చేస్తే రోజుకు ₹3000. ముందు ₹500 రిజిస్ట్రేషన్ ఫీజు UPI ద్వారా చెల్లించండి.';

let updateId = 1;
function update(message: Record<string, unknown>, secret: string | null = SECRET) {
  return new Request('https://akshi.example/api/telegram', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(secret === null ? {} : { 'x-telegram-bot-api-secret-token': secret }),
    },
    body: JSON.stringify({ update_id: updateId++, message }),
  });
}
const msg = (extra: Record<string, unknown>, chatId = 42, lang = 'en') => ({
  message_id: 7,
  chat: { id: chatId, type: 'private' },
  from: { language_code: lang },
  ...extra,
});
interface Reply {
  method: string;
  chat_id: number;
  text: string;
  parse_mode: string;
  reply_parameters: { message_id: number };
}

beforeEach(() => {
  resetRateLimits();
  vi.stubEnv('TELEGRAM_WEBHOOK_SECRET', SECRET);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('POST /api/telegram', () => {
  it('is switched off until the webhook secret is configured', async () => {
    vi.stubEnv('TELEGRAM_WEBHOOK_SECRET', '');
    const res = await telegram(update(msg({ text: KYC })));
    expect(res.status).toBe(503);
  });

  it('refuses updates without the right secret', async () => {
    expect((await telegram(update(msg({ text: KYC }), null))).status).toBe(401);
    expect((await telegram(update(msg({ text: KYC }), 'wrong'))).status).toBe(401);
    expect((await telegram(update(msg({ text: KYC }), `${SECRET}x`))).status).toBe(401);
  });

  it('answers a forwarded scam with the verdict, reasons and steps, calling nothing outside', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const res = await telegram(update(msg({ text: KYC, forward_origin: { type: 'hidden_user' } })));
    expect(res.status).toBe(200);
    const body = (await res.json()) as Reply;
    expect(body.method).toBe('sendMessage');
    expect(body.chat_id).toBe(42);
    expect(body.parse_mode).toBe('HTML');
    expect(body.reply_parameters.message_id).toBe(7);
    expect(body.text).toContain(`<b>${BOT.en.verdict.scam}</b>`);
    expect(body.text).toContain(`<b>${BOT.en.why}</b>`);
    expect(body.text).toContain(`<b>${BOT.en.doNow}</b>`);
    expect(body.text).toContain('https://akshi.example/scan');
    expect(body.text).toContain(BOT.en.footer);
    // the sample indicator match keeps its sample-data label
    expect(body.text).toMatch(/Reported before: .*\(sample data\)/);
    // never echoes the message, never says "safe"
    expect(body.text).not.toContain('share the OTP you receive');
    expect(body.text).not.toMatch(/\bsafe\b/i);
    expect(body.text.length).toBeLessThan(4096);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('replies in the language of the message', async () => {
    const res = await telegram(update(msg({ text: TE_JOB }, 42, 'en')));
    const body = (await res.json()) as Reply;
    expect(body.text).toMatch(/[ఀ-౿]/);
    expect(body.text).toContain(BOT.te.footer);
  });

  it('says "No warning signs found" for a genuine message, with a reminder, never "safe"', async () => {
    const res = await telegram(
      update(
        msg({ text: 'Your OTP for login is 482913. Do not share it with anyone. -HDFC Bank' }),
      ),
    );
    const body = (await res.json()) as Reply;
    expect(body.text).toContain(BOT.en.verdict.no_signs);
    expect(body.text).toContain(BOT.en.stillCareful);
    expect(body.text).not.toMatch(/\bsafe\b/i);
  });

  it('welcomes on /start and /help in the app language', async () => {
    const start = (await (
      await telegram(update(msg({ text: '/start' }, 1, 'hi')))
    ).json()) as Reply;
    expect(start.text).toBe(BOT.hi.welcome);
    const help = (await (await telegram(update(msg({ text: '/help@AkshiBot' })))).json()) as Reply;
    expect(help.text).toBe(BOT.en.welcome);
  });

  it('points photos without text to the website, and checks a caption', async () => {
    const photo = (await (
      await telegram(update(msg({ photo: [{ file_id: 'x' }] })))
    ).json()) as Reply;
    expect(photo.text).toContain(BOT.en.photo);
    expect(photo.text).toContain('https://akshi.example/scan');
    const caption = (await (
      await telegram(update(msg({ photo: [{ file_id: 'x' }], caption: KYC })))
    ).json()) as Reply;
    expect(caption.text).toContain(BOT.en.verdict.scam);
  });

  it('stays quiet in groups and on updates without a message', async () => {
    const group = await telegram(
      update({ message_id: 1, chat: { id: -100, type: 'group' }, text: KYC }),
    );
    expect(group.status).toBe(200);
    expect(await group.text()).toBe('');
    const edited = new Request('https://akshi.example/api/telegram', {
      method: 'POST',
      headers: { 'x-telegram-bot-api-secret-token': SECRET },
      body: JSON.stringify({ update_id: 99, edited_message: { text: KYC } }),
    });
    const res = await telegram(edited);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('');
  });

  it('limits each chat to 20 checks a minute, without affecting other chats', async () => {
    for (let i = 0; i < 20; i++) await telegram(update(msg({ text: '/start' }, 5)));
    const over = (await (await telegram(update(msg({ text: '/start' }, 5)))).json()) as Reply;
    expect(over.text).toBe(BOT.en.limited);
    const other = (await (await telegram(update(msg({ text: '/start' }, 6)))).json()) as Reply;
    expect(other.text).toBe(BOT.en.welcome);
  });
});

describe('telegram helpers', () => {
  it('escapes HTML', () => {
    expect(escapeHtml('<b>&"x"</b>')).toBe('&lt;b&gt;&amp;"x"&lt;/b&gt;');
  });
  it('picks languages', () => {
    expect(appLang('hi')).toBe('hi');
    expect(appLang('en-GB')).toBe('en');
    expect(appLang('ta')).toBe('en');
    expect(appLang(undefined)).toBe('en');
    expect(replyLang('te', 'en')).toBe('te');
    expect(replyLang('mixed', 'hi')).toBe('hi');
    expect(replyLang('en', 'bn')).toBe('bn');
  });
  it('has every string in every language', () => {
    const keys = Object.keys(BOT.en).sort();
    for (const l of ['hi', 'te', 'bn'] as const) expect(Object.keys(BOT[l]).sort()).toEqual(keys);
  });
});
