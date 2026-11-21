/**
 * Akshi on Telegram: the pure part of the bot (api/telegram.ts is the webhook). Parses an update,
 * picks the reply language, and formats a check as a Telegram message (HTML parse mode).
 *
 * Truth rules (SPEC.md §1.3): the lowest verdict is "No warning signs found", never "safe"; the bot
 * never repeats the user's message and says that it does not store it.
 */
import { LANGS, type AnalysisResult, type Lang } from '@akshi/contracts';
import { actionText, categoryText } from '@akshi/engine';
import { z } from 'zod';

export const UpdateSchema = z.object({
  update_id: z.number(),
  message: z
    .object({
      message_id: z.number(),
      chat: z.object({ id: z.number(), type: z.string() }),
      from: z.object({ language_code: z.string().optional() }).optional(),
      text: z.string().optional(),
      caption: z.string().optional(),
      photo: z.array(z.unknown()).optional(),
      document: z.unknown().optional(),
    })
    .optional(),
});
export type Update = z.infer<typeof UpdateSchema>;

/**
 * Telegram's limit for one message is 4096 characters. Everything but the explanation is short and
 * bounded (four reasons, four actions), so only the explanation is capped, before escaping, so a
 * cut never breaks the HTML.
 */
export const MAX_EXPLANATION = 900;

interface BotText {
  verdict: Record<AnalysisResult['verdict'], string>;
  risk: string;
  why: string;
  doNow: string;
  stillCareful: string;
  footer: string;
  fullCheck: string;
  welcome: string;
  photo: string;
  empty: string;
  limited: string;
  failed: string;
}

/** Verdict words match the website (apps/web/src/locales/*.json `verdict`). */
export const BOT: Record<Lang, BotText> = {
  en: {
    verdict: { scam: 'Scam', suspicious: 'Suspicious', no_signs: 'No warning signs found' },
    risk: 'Risk',
    why: 'Why',
    doNow: 'What to do',
    stillCareful: 'Still be careful: never share an OTP, PIN or password with anyone.',
    footer: 'Checked by Akshi Rakshak. Your message is not stored.',
    fullCheck: 'Full check with highlights',
    welcome:
      "Hi! I'm Akshi Rakshak 🛡️\n\nForward me any suspicious SMS, WhatsApp message, link or UPI ID. I'll tell you if it looks like a scam, why, and what to do next.\n\nI reply in the language of your message: English, हिंदी, తెలుగు or বাংলা. I don't store your messages.",
    photo:
      'I can only read text here. Forward the message text, or open the website to check a screenshot:',
    empty: 'Send me the text of the message you want to check.',
    limited: 'Too many checks in a minute. Please wait a little and try again.',
    failed: 'Sorry, the check failed. Please try again.',
  },
  hi: {
    verdict: { scam: 'धोखा', suspicious: 'संदिग्ध', no_signs: 'चेतावनी का कोई निशान नहीं मिला' },
    risk: 'जोखिम',
    why: 'क्यों',
    doNow: 'क्या करें',
    stillCareful: 'फिर भी सावधान रहें: OTP, PIN या पासवर्ड किसी को न बताएँ।',
    footer: 'अक्षि रक्षक ने जाँचा। आपका मैसेज सेव नहीं किया जाता।',
    fullCheck: 'हाइलाइट के साथ पूरी जाँच',
    welcome:
      'नमस्ते! मैं अक्षि रक्षक हूँ 🛡️\n\nकोई भी संदिग्ध SMS, WhatsApp मैसेज, लिंक या UPI ID मुझे फ़ॉरवर्ड करें। मैं बताऊँगा कि यह ठगी लगती है या नहीं, क्यों, और आगे क्या करें।\n\nमैं आपके मैसेज की भाषा में जवाब देता हूँ: English, हिंदी, తెలుగు या বাংলা। मैं आपके मैसेज सेव नहीं करता।',
    photo: 'यहाँ मैं सिर्फ़ टेक्स्ट पढ़ सकता हूँ। मैसेज का टेक्स्ट फ़ॉरवर्ड करें, या स्क्रीनशॉट जाँचने के लिए वेबसाइट खोलें:',
    empty: 'जिस मैसेज को जाँचना है, उसका टेक्स्ट भेजें।',
    limited: 'एक मिनट में बहुत ज़्यादा जाँचें हो गईं। थोड़ा रुककर फिर कोशिश करें।',
    failed: 'माफ़ कीजिए, जाँच नहीं हो पाई। फिर से कोशिश करें।',
  },
  te: {
    verdict: { scam: 'మోసం', suspicious: 'అనుమానాస్పదం', no_signs: 'హెచ్చరిక గుర్తులు ఏవీ కనిపించలేదు' },
    risk: 'ప్రమాదం',
    why: 'ఎందుకు',
    doNow: 'ఏం చేయాలి',
    stillCareful: 'అయినా జాగ్రత్త: OTP, PIN లేదా పాస్‌వర్డ్ ఎవరికీ చెప్పకండి.',
    footer: 'అక్షి రక్షక్ పరిశీలించింది. మీ మెసేజ్ సేవ్ చేయబడదు.',
    fullCheck: 'హైలైట్‌లతో పూర్తి పరిశీలన',
    welcome:
      'నమస్తే! నేను అక్షి రక్షక్ 🛡️\n\nఏదైనా అనుమానాస్పద SMS, WhatsApp మెసేజ్, లింక్ లేదా UPI IDని నాకు ఫార్వర్డ్ చేయండి. అది మోసంలా ఉందో లేదో, ఎందుకో, తర్వాత ఏం చేయాలో చెబుతాను.\n\nమీ మెసేజ్ భాషలోనే జవాబిస్తాను: English, हिंदी, తెలుగు లేదా বাংলা. మీ మెసేజ్‌లను నేను సేవ్ చేయను.',
    photo: 'ఇక్కడ నేను టెక్స్ట్ మాత్రమే చదవగలను. మెసేజ్ టెక్స్ట్‌ను ఫార్వర్డ్ చేయండి, లేదా స్క్రీన్‌షాట్ పరిశీలించడానికి వెబ్‌సైట్ తెరవండి:',
    empty: 'పరిశీలించాల్సిన మెసేజ్ టెక్స్ట్‌ను పంపండి.',
    limited: 'ఒక నిమిషంలో చాలా ఎక్కువ పరిశీలనలు. కాసేపు ఆగి మళ్లీ ప్రయత్నించండి.',
    failed: 'క్షమించండి, పరిశీలన విఫలమైంది. మళ్లీ ప్రయత్నించండి.',
  },
  bn: {
    verdict: { scam: 'প্রতারণা', suspicious: 'সন্দেহজনক', no_signs: 'কোনো সতর্কতার লক্ষণ পাওয়া যায়নি' },
    risk: 'ঝুঁকি',
    why: 'কেন',
    doNow: 'কী করবেন',
    stillCareful: 'তবুও সাবধান: OTP, PIN বা পাসওয়ার্ড কাউকে বলবেন না।',
    footer: 'অক্ষি রক্ষক যাচাই করেছে। আপনার মেসেজ সংরক্ষণ করা হয় না।',
    fullCheck: 'হাইলাইটসহ পুরো যাচাই',
    welcome:
      'নমস্কার! আমি অক্ষি রক্ষক 🛡️\n\nযেকোনো সন্দেহজনক SMS, WhatsApp মেসেজ, লিংক বা UPI ID আমাকে ফরোয়ার্ড করুন। এটা প্রতারণা মনে হচ্ছে কি না, কেন, আর এরপর কী করবেন, তা জানাব।\n\nআপনার মেসেজের ভাষাতেই উত্তর দিই: English, हिंदी, తెలుగు বা বাংলা। আমি আপনার মেসেজ সংরক্ষণ করি না।',
    photo:
      'এখানে আমি শুধু লেখা পড়তে পারি। মেসেজের লেখা ফরোয়ার্ড করুন, অথবা স্ক্রিনশট যাচাই করতে ওয়েবসাইট খুলুন:',
    empty: 'যে মেসেজ যাচাই করতে চান, তার লেখা পাঠান।',
    limited: 'এক মিনিটে অনেক বেশি যাচাই হয়েছে। একটু অপেক্ষা করে আবার চেষ্টা করুন।',
    failed: 'দুঃখিত, যাচাই হয়নি। আবার চেষ্টা করুন।',
  },
};

const VERDICT_MARK: Record<AnalysisResult['verdict'], string> = {
  scam: '🔴',
  suspicious: '🟠',
  no_signs: '🟢',
};

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** The user's Telegram app language, when it is one Akshi speaks. */
export function appLang(code: string | undefined): Lang {
  const base = (code ?? '').toLowerCase().split('-')[0] ?? '';
  return (LANGS as readonly string[]).includes(base) ? (base as Lang) : 'en';
}

/**
 * Reply in the language of the message when it is Hindi, Telugu or Bengali (someone forwarding a
 * Telugu scam reads Telugu), otherwise in the app language.
 */
export function replyLang(detected: AnalysisResult['detectedLang'], app: Lang): Lang {
  return detected === 'hi' || detected === 'te' || detected === 'bn' ? detected : app;
}

export type Incoming =
  | { kind: 'ignore' }
  | { kind: 'command'; command: 'start' | 'help'; chatId: number; messageId: number; lang: Lang }
  | { kind: 'photo'; chatId: number; messageId: number; lang: Lang }
  | { kind: 'empty'; chatId: number; messageId: number; lang: Lang }
  | { kind: 'text'; text: string; chatId: number; messageId: number; lang: Lang };

/** What an update asks for. Private chats only: in a group the bot stays quiet. */
export function readUpdate(update: Update): Incoming {
  const m = update.message;
  if (!m || m.chat.type !== 'private') return { kind: 'ignore' };
  const base = { chatId: m.chat.id, messageId: m.message_id, lang: appLang(m.from?.language_code) };
  const text = (m.text ?? m.caption ?? '').trim();
  const command = /^\/(start|help)(?:@\w+)?(?:\s|$)/i.exec(text)?.[1]?.toLowerCase();
  if (command === 'start' || command === 'help') return { kind: 'command', command, ...base };
  if (!text) return m.photo || m.document ? { kind: 'photo', ...base } : { kind: 'empty', ...base };
  return { kind: 'text', text, ...base };
}

/** A check as a Telegram message: verdict, explanation, top reasons, what to do, footer. */
export function formatResult(result: AnalysisResult, lang: Lang, siteUrl: string): string {
  const t = BOT[lang];
  const lines: string[] = [];
  lines.push(
    `${VERDICT_MARK[result.verdict]} <b>${escapeHtml(t.verdict[result.verdict])}</b> · ${escapeHtml(t.risk)} ${result.riskScore}/100`,
  );
  if (result.category && result.verdict !== 'no_signs') {
    lines.push(`<i>${escapeHtml(categoryText(result.category, lang).name)}</i>`);
  }
  const explanation =
    result.explanation.length > MAX_EXPLANATION
      ? `${result.explanation.slice(0, MAX_EXPLANATION - 1).trimEnd()}…`
      : result.explanation;
  if (explanation) lines.push('', escapeHtml(explanation));

  const reasons = result.signals
    .filter((s) => s.weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 4);
  if (reasons.length) {
    lines.push('', `<b>${escapeHtml(t.why)}</b>`);
    for (const s of reasons) {
      // a match in the bundled indicator list must keep its "(sample data)" note (truth rules)
      const note = s.id === 'KNOWN_INDICATOR' && s.detail ? `: ${s.detail}` : '';
      lines.push(`• ${escapeHtml(s.label + note)}`);
    }
  }

  const actions = result.actions.filter((a) => a !== 'no_action_needed').slice(0, 4);
  if (actions.length) {
    lines.push('', `<b>${escapeHtml(t.doNow)}</b>`);
    for (const a of actions) {
      const { label, body } = actionText(a, lang);
      lines.push(`• <b>${escapeHtml(label)}</b>: ${escapeHtml(body)}`);
    }
  }
  if (result.verdict === 'no_signs') lines.push('', escapeHtml(t.stillCareful));

  lines.push(
    '',
    `<i>${escapeHtml(t.footer)}</i>`,
    `<a href="${escapeHtml(siteUrl)}/scan">${escapeHtml(t.fullCheck)}</a>`,
  );
  return lines.join('\n');
}

/** The webhook answer: Telegram performs this sendMessage itself, so the server calls nothing. */
export function sendMessage(chatId: number, replyTo: number, text: string) {
  return {
    method: 'sendMessage',
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
    reply_parameters: { message_id: replyTo, allow_sending_without_reply: true },
  };
}
