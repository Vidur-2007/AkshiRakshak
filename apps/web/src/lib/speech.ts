/**
 * speechSynthesis wrapper (M1.14). Picks a voice whose lang starts with the UI
 * language code, falling back to English.
 */
import type { Lang } from './engine';

export interface VoiceLike {
  lang: string;
  name: string;
  default?: boolean;
  localService?: boolean;
}

const norm = (l: string) => l.toLowerCase().replace('_', '-');

/** Best voice for `code`: the Indian variant first, then an on-device voice, then any. */
function bestFor<V extends VoiceLike>(voices: readonly V[], code: string): V | null {
  const list = voices.filter((v) => norm(v.lang).startsWith(code));
  return (
    list.find((v) => norm(v.lang) === `${code}-in`) ??
    list.find((v) => v.localService) ??
    list[0] ??
    null
  );
}

export function pickVoice<V extends VoiceLike>(voices: readonly V[], lang: Lang): V | null {
  return bestFor(voices, lang) ?? bestFor(voices, 'en');
}

export function speechSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    'SpeechSynthesisUtterance' in window
  );
}

/** Speaks `text` and calls `onEnd` when finished, cancelled or failed. Returns a stop function. */
export function speak(text: string, lang: Lang, onEnd?: () => void): () => void {
  if (!speechSupported() || !text.trim()) {
    onEnd?.();
    return () => undefined;
  }
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const voice = pickVoice(synth.getVoices(), lang);
  if (voice) {
    u.voice = voice;
    u.lang = voice.lang;
  } else {
    u.lang = lang === 'en' ? 'en-IN' : `${lang}-IN`;
  }
  u.rate = 0.95;
  u.onend = () => onEnd?.();
  u.onerror = () => onEnd?.();
  synth.speak(u);
  return () => synth.cancel();
}

export function stopSpeaking(): void {
  if (speechSupported()) window.speechSynthesis.cancel();
}
