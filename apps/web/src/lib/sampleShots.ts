/**
 * Sample screenshots (2026-11-22): made-up phone screenshots in `public/samples/`, so the screenshot
 * check can be tried (and demoed) without a phone. Tapping one runs the real on-device OCR, exactly
 * like a chosen file. Every name, number and link in them is invented.
 */
import type { Lang } from './engine';

export interface SampleShot {
  id: 'sms-kyc-en' | 'chat-otp-en' | 'sms-job-te';
  /** i18n key for the chip label */
  label: string;
  /** the language the screenshot is written in, read whatever the UI language is */
  lang: Lang;
}

export const SAMPLE_SHOTS: readonly SampleShot[] = [
  { id: 'sms-kyc-en', label: 'shot.sampleKyc', lang: 'en' },
  { id: 'chat-otp-en', label: 'shot.sampleChat', lang: 'en' },
  { id: 'sms-job-te', label: 'shot.sampleTelugu', lang: 'te' },
];

export const sampleShotUrl = (s: Pick<SampleShot, 'id'>) =>
  `${import.meta.env.BASE_URL}samples/${s.id}.png`;

/** OCR languages for a sample: its own language, plus English for numbers and links. */
export const sampleShotLangs = (s: Pick<SampleShot, 'lang'>): Lang[] =>
  s.lang === 'en' ? ['en'] : [s.lang, 'en'];

/** Loads a sample as a File, the same thing the file picker hands over. */
export async function loadSampleShot(s: Pick<SampleShot, 'id'>): Promise<File> {
  const res = await fetch(sampleShotUrl(s));
  if (!res.ok) throw new Error(`sample ${s.id}: HTTP ${res.status}`);
  const blob = await res.blob();
  return new File([blob], `${s.id}.png`, { type: 'image/png' });
}
