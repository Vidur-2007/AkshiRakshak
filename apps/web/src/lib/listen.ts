/**
 * Live listen (M1.15): a thin wrapper over the browser's SpeechRecognition with
 * interim results. The words go to the engine's live listener on this device; the
 * speech-to-text itself is done by the browser's speech service (in Chrome, that
 * means Google's servers), which the UI says plainly.
 */
import type { Lang } from './engine';

interface RecognitionAlternative {
  transcript: string;
}
interface RecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: RecognitionAlternative;
}
interface RecognitionEvent {
  readonly resultIndex: number;
  readonly results: { readonly length: number; [index: number]: RecognitionResult };
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => Recognition;

function ctor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function listenSupported(): boolean {
  return ctor() !== null;
}

/** BCP-47 tag for recognition: the Indian variant of each UI language. */
export const RECOGNITION_LANG: Record<Lang, string> = {
  en: 'en-IN',
  hi: 'hi-IN',
  te: 'te-IN',
  bn: 'bn-IN',
};

export type ListenError = 'denied' | 'no-speech' | 'network' | 'unsupported' | 'other';

export function toListenError(code: string): ListenError {
  if (code === 'not-allowed' || code === 'service-not-allowed') return 'denied';
  if (code === 'no-speech') return 'no-speech';
  if (code === 'network') return 'network';
  return 'other';
}

export interface Listening {
  stop(): void;
}

/**
 * Starts continuous recognition. `onText` gets every interim and final chunk in
 * order. Chrome ends a session after silence; we restart it until `stop()`.
 */
export function startListening(
  lang: Lang,
  onText: (text: string, isFinal: boolean) => void,
  onError: (e: ListenError) => void,
): Listening {
  const Ctor = ctor();
  if (!Ctor) {
    onError('unsupported');
    return { stop: () => undefined };
  }
  let active = true;
  let rec: Recognition | null = null;
  const begin = () => {
    rec = new Ctor();
    rec.lang = RECOGNITION_LANG[lang];
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const text = r?.[0]?.transcript ?? '';
        if (r && text) onText(text, r.isFinal);
      }
    };
    rec.onerror = (e) => {
      const err = toListenError(e.error);
      if (err === 'no-speech') return; // silence: onend restarts
      active = false;
      onError(err);
    };
    rec.onend = () => {
      if (active) {
        try {
          begin();
        } catch {
          active = false;
          onError('other');
        }
      }
    };
    rec.start();
  };
  try {
    begin();
  } catch {
    active = false;
    onError('other');
  }
  return {
    stop: () => {
      active = false;
      rec?.stop();
    },
  };
}
