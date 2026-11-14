/**
 * UPI app behind a handle, for QRXray (§5.6). Only widely documented handles;
 * anything else shows the handle itself, never a guess.
 */
const APPS: [RegExp, string][] = [
  [/^(ybl|ibl|axl)$/, 'PhonePe'],
  [/^(okaxis|okhdfcbank|okicici|oksbi)$/, 'Google Pay'],
  [/^(paytm|ptsbi|pthdfc|ptyes|ptaxis)$/, 'Paytm'],
  [/^(apl|yapl|rapl)$/, 'Amazon Pay'],
  [/^upi$/, 'BHIM'],
];

export function upiHandle(upiId: string): string {
  return upiId.split('@')[1]?.trim().toLowerCase() ?? '';
}

export function upiApp(upiId: string): string | null {
  const handle = upiHandle(upiId);
  for (const [re, app] of APPS) if (re.test(handle)) return app;
  return null;
}
