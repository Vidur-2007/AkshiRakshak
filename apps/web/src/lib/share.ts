/**
 * Share cards (§5.15): masking for the scam's details, and Web Share with a
 * download fallback. Never include the user's own phone number or UPI ID; the
 * scam's UPI IDs and links are shown partially (kyc.upd…@ybl).
 */
import { guessRegistrable } from './urlParts';

/** "kyc.update.helpdesk@ybl" → "kyc.upd…@ybl" */
export function maskUpi(upi: string): string {
  const [user = '', handle = ''] = upi.trim().split('@');
  if (!handle) return user.length > 4 ? `${user.slice(0, 3)}…` : '…';
  const keep = Math.min(7, Math.max(2, Math.floor(user.length / 2)));
  return `${user.slice(0, keep)}${user.length > keep ? '…' : ''}@${handle}`;
}

/** "http://sbi-kyc-update.xyz/verify?id=1" → "sbi-kyc-u….xyz" (no path, no query). */
export function maskUrl(url: string): string {
  let host = url.trim();
  try {
    host = new URL(/^[a-z]+:\/\//i.test(host) ? host : `http://${host}`).hostname;
  } catch {
    host = host.replace(/^[a-z]+:\/\//i, '').split(/[/?#]/)[0] ?? host;
  }
  const domain = guessRegistrable(host);
  const dot = domain.indexOf('.');
  const name = dot > 0 ? domain.slice(0, dot) : domain;
  const tld = dot > 0 ? domain.slice(dot) : '';
  const keep = Math.min(9, Math.max(3, Math.ceil(name.length / 2)));
  return `${name.slice(0, keep)}${name.length > keep ? '…' : ''}${tld}`;
}

export function canShareFiles(file: File): boolean {
  try {
    return typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

/** Shares the PNG where the browser can share files; otherwise downloads it. */
export async function shareOrDownload(
  blob: Blob,
  filename: string,
  text: string,
): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const file = new File([blob], filename, { type: 'image/png' });
  if (canShareFiles(file)) {
    try {
      await navigator.share({ files: [file], text });
      return 'shared';
    } catch (err) {
      if ((err as { name?: string } | null)?.name === 'AbortError') return 'cancelled';
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return 'downloaded';
}

/** Renders a DOM node to PNG with html-to-image (loaded only when sharing). */
export async function nodeToPng(node: HTMLElement, width: number, height: number): Promise<Blob> {
  const { toBlob } = await import('html-to-image');
  const blob = await toBlob(node, { width, height, pixelRatio: 1, cacheBust: true });
  if (!blob) throw new Error('render failed');
  return blob;
}
