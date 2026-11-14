/**
 * Punycode label decoding (RFC 3492), for showing IDN hosts the way the user would see them.
 * The URL API gives `xn--` ASCII hostnames; this turns them back into Unicode.
 */
const BASE = 36;
const TMIN = 1;
const TMAX = 26;
const SKEW = 38;
const DAMP = 700;
const INITIAL_BIAS = 72;
const INITIAL_N = 128;

function adapt(delta: number, numPoints: number, first: boolean): number {
  let d = first ? Math.floor(delta / DAMP) : delta >> 1;
  d += Math.floor(d / numPoints);
  let k = 0;
  while (d > ((BASE - TMIN) * TMAX) >> 1) {
    d = Math.floor(d / (BASE - TMIN));
    k += BASE;
  }
  return k + Math.floor(((BASE - TMIN + 1) * d) / (d + SKEW));
}

function digit(cp: number): number {
  if (cp >= 0x30 && cp <= 0x39) return cp - 22; // 0-9 → 26-35
  if (cp >= 0x41 && cp <= 0x5a) return cp - 0x41; // A-Z
  if (cp >= 0x61 && cp <= 0x7a) return cp - 0x61; // a-z
  return BASE;
}

/** Decode one label without the `xn--` prefix. Returns null on malformed input. */
export function decodePunycode(input: string): string | null {
  const out: number[] = [];
  const basic = input.lastIndexOf('-');
  for (let j = 0; j < Math.max(basic, 0); j++) {
    const c = input.charCodeAt(j);
    if (c >= 0x80) return null;
    out.push(c);
  }
  let n = INITIAL_N;
  let bias = INITIAL_BIAS;
  let i = 0;
  for (let idx = basic > 0 ? basic + 1 : 0; idx < input.length;) {
    const oldi = i;
    let w = 1;
    for (let k = BASE; ; k += BASE) {
      if (idx >= input.length) return null;
      const d = digit(input.charCodeAt(idx++));
      if (d >= BASE) return null;
      i += d * w;
      const t = k <= bias ? TMIN : k >= bias + TMAX ? TMAX : k - bias;
      if (d < t) break;
      w *= BASE - t;
      if (w > 0x7fffffff) return null;
    }
    bias = adapt(i - oldi, out.length + 1, oldi === 0);
    n += Math.floor(i / (out.length + 1));
    i %= out.length + 1;
    if (n > 0x10ffff) return null;
    out.splice(i++, 0, n);
  }
  return String.fromCodePoint(...out);
}

/** Decode every `xn--` label of a host; other labels are kept. */
export function toUnicodeHost(host: string): string {
  return host
    .split('.')
    .map((l) => (l.startsWith('xn--') ? (decodePunycode(l.slice(4)) ?? l) : l))
    .join('.');
}
