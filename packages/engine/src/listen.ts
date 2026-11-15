/**
 * Live listen phrase spotting (SPEC.md M1.15, P2). B feeds speech-recognition transcripts during a
 * call (interim and final results); the listener keeps the final text, scores it with the rules
 * layer (scoreLive) and reports each call-danger signal once, the first time it is heard, so the
 * UI can raise one alert per new danger ("They asked for your OTP — hang up").
 * Isomorphic and synchronous; nothing leaves the device.
 */
import { normalizeText, type Lang, type LiveScore, type SignalId } from '@akshi/contracts';
import { signalText } from './i18n';
import { scoreLive } from './pipeline/live';
import { matchRules } from './rules/engine';

/** Signals worth interrupting a phone call for. */
export const CALL_ALERT_SIGNALS: readonly SignalId[] = [
  'ASKS_OTP',
  'ASKS_PIN',
  'ASKS_CVV_PASSWORD',
  'ASKS_REMOTE_APP',
  'RECEIVE_WITH_PIN',
  'QR_TO_RECEIVE',
  'APK_LINK',
  'STAY_ON_CALL',
  'THREAT_LEGAL',
  'SECRECY',
  'ADVANCE_FEE',
];
const ALERT_SET = new Set<SignalId>(CALL_ALERT_SIGNALS);
/** Keep the last ~2,000 characters of final transcript (a long call should not slow scoring). */
const MAX_CHARS = 2_000;

export interface ListenAlert {
  id: SignalId;
  label: string;
  detail: string;
  /** the heard words that triggered it */
  phrase: string;
}

export interface ListenUpdate {
  score: LiveScore;
  /** call-danger signals heard for the first time in this update */
  alerts: ListenAlert[];
  /** final transcript so far plus the current interim result */
  transcript: string;
}

export interface LiveListener {
  /** Feed one recognition result. Interim results replace each other; final ones accumulate. */
  push(text: string, isFinal: boolean): ListenUpdate;
  reset(): void;
}

export function createLiveListener(lang: Lang): LiveListener {
  let finals = '';
  const alerted = new Set<SignalId>();
  return {
    push(text, isFinal) {
      const chunk = normalizeText(text);
      if (isFinal && chunk) finals = `${finals} ${chunk}`.trim().slice(-MAX_CHARS);
      const transcript = isFinal || !chunk ? finals : `${finals} ${chunk}`.trim();
      const alerts: ListenAlert[] = [];
      for (const h of matchRules(transcript)) {
        if (!ALERT_SET.has(h.id) || alerted.has(h.id)) continue;
        // interim words can still change: alert only once the phrase is in final text, or for
        // the strongest asks right away (OTP, PIN, screen sharing)
        const urgent = h.id === 'ASKS_OTP' || h.id === 'ASKS_PIN' || h.id === 'ASKS_REMOTE_APP';
        if (!isFinal && !urgent && !matchRules(finals).some((f) => f.id === h.id)) continue;
        alerted.add(h.id);
        alerts.push({ id: h.id, ...signalText(h.id, lang), phrase: h.spans[0]?.text ?? '' });
      }
      return { score: scoreLive(transcript, lang), alerts, transcript };
    },
    reset() {
      finals = '';
      alerted.clear();
    },
  };
}
