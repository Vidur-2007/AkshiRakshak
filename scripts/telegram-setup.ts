/**
 * One-time setup for the Akshi Telegram bot (api/telegram.ts). Run on your own computer; the bot
 * token is read from your shell and is never written anywhere or sent to Vercel.
 *
 *   1. npm run telegram:setup -- --new-secret
 *        prints a random webhook secret. Add it in Vercel as TELEGRAM_WEBHOOK_SECRET and redeploy.
 *   2. TELEGRAM_BOT_TOKEN=<from @BotFather> TELEGRAM_WEBHOOK_SECRET=<the secret> \
 *        npm run telegram:setup -- https://akshi-rakshak.vercel.app
 *        points the bot at <site>/api/telegram, sets its commands and descriptions (en/hi/te/bn),
 *        and checks that the site answers with the secret in place.
 */
import { randomBytes } from 'node:crypto';

const args = process.argv.slice(2);

if (args.includes('--new-secret')) {
  console.log(randomBytes(32).toString('base64url'));
  console.error(
    '\nAdd this in Vercel → Settings → Environment Variables as TELEGRAM_WEBHOOK_SECRET',
  );
  console.error('(Production), redeploy, then run this script again with your site URL.');
  process.exit(0);
}

const site = args.find((a) => /^https:\/\//.test(a))?.replace(/\/+$/, '');
const token = process.env.TELEGRAM_BOT_TOKEN?.trim() ?? '';
const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim() ?? '';
const fail = (msg: string): never => {
  console.error(msg);
  process.exit(1);
};
if (!site) fail('Usage: npm run telegram:setup -- https://<your-site>   (or -- --new-secret)');
if (!/^\d{6,}:[A-Za-z0-9_-]{30,}$/.test(token))
  fail('Set TELEGRAM_BOT_TOKEN to the token @BotFather gave you (it looks like 123456:ABC...).');
if (!/^[A-Za-z0-9_-]{16,256}$/.test(secret))
  fail('Set TELEGRAM_WEBHOOK_SECRET (make one with: npm run telegram:setup -- --new-secret).');

async function call(method: string, body: Record<string, unknown> = {}): Promise<unknown> {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as { ok: boolean; result?: unknown; description?: string };
  if (!data.ok) fail(`${method} failed: ${data.description ?? res.status}`); // never prints the token
  return data.result;
}

const TEXT = {
  en: {
    command: 'How to use Akshi',
    short: 'Forward a suspicious message. Get a scam check in seconds.',
    long: 'Forward any suspicious SMS, WhatsApp message, link or UPI ID. Akshi Rakshak tells you if it looks like a scam, why, and what to do next, in English, Hindi, Telugu or Bengali. Free. Your messages are not stored.',
  },
  hi: {
    command: 'अक्षि का इस्तेमाल कैसे करें',
    short: 'संदिग्ध मैसेज फ़ॉरवर्ड करें, कुछ सेकंड में ठगी की जाँच पाएँ।',
    long: 'कोई भी संदिग्ध SMS, WhatsApp मैसेज, लिंक या UPI ID फ़ॉरवर्ड करें। अक्षि रक्षक बताता है कि यह ठगी लगती है या नहीं, क्यों, और आगे क्या करें। मुफ़्त। आपके मैसेज सेव नहीं होते।',
  },
  te: {
    command: 'అక్షిని ఎలా వాడాలి',
    short: 'అనుమానాస్పద మెసేజ్‌ను ఫార్వర్డ్ చేయండి, క్షణాల్లో మోసం పరిశీలన పొందండి.',
    long: 'ఏదైనా అనుమానాస్పద SMS, WhatsApp మెసేజ్, లింక్ లేదా UPI IDని ఫార్వర్డ్ చేయండి. అది మోసంలా ఉందో లేదో, ఎందుకో, తర్వాత ఏం చేయాలో అక్షి రక్షక్ చెబుతుంది. ఉచితం. మీ మెసేజ్‌లు సేవ్ కావు.',
  },
  bn: {
    command: 'অক্ষি কীভাবে ব্যবহার করবেন',
    short: 'সন্দেহজনক মেসেজ ফরোয়ার্ড করুন, কয়েক সেকেন্ডে প্রতারণা যাচাই পান।',
    long: 'যেকোনো সন্দেহজনক SMS, WhatsApp মেসেজ, লিংক বা UPI ID ফরোয়ার্ড করুন। এটা প্রতারণা মনে হচ্ছে কি না, কেন, আর এরপর কী করবেন, অক্ষি রক্ষক জানায়। বিনামূল্যে। আপনার মেসেজ সংরক্ষণ করা হয় না।',
  },
} as const;

const me = (await call('getMe')) as { username: string };
console.log(`Bot: @${me.username}`);

await call('setWebhook', {
  url: `${site}/api/telegram`,
  secret_token: secret,
  allowed_updates: ['message'],
  drop_pending_updates: true,
  max_connections: 10,
});
console.log(`Webhook: ${site}/api/telegram`);

for (const [lang, t] of Object.entries(TEXT)) {
  const scope = lang === 'en' ? {} : { language_code: lang };
  await call('setMyCommands', {
    commands: [
      { command: 'start', description: t.command },
      { command: 'help', description: t.command },
    ],
    ...scope,
  });
  await call('setMyShortDescription', { short_description: t.short, ...scope });
  await call('setMyDescription', { description: t.long, ...scope });
}
console.log('Commands and descriptions: en, hi, te, bn');

// The site must refuse a request without the secret (401). 503 means the secret is not set there.
const probe = await fetch(`${site}/api/telegram`, { method: 'POST', body: '{}' });
if (probe.status === 401) console.log('Site check: the webhook is live and needs the secret ✔');
else if (probe.status === 503)
  console.log(
    'Site check: TELEGRAM_WEBHOOK_SECRET is not set on the site yet. Add it and redeploy.',
  );
else console.log(`Site check: unexpected status ${probe.status} from ${site}/api/telegram`);

const info = (await call('getWebhookInfo')) as {
  pending_update_count: number;
  last_error_message?: string;
};
if (info.last_error_message)
  console.log(`Telegram's last delivery error: ${info.last_error_message}`);
console.log(`\nDone. Open https://t.me/${me.username}, press Start and forward a message.`);
