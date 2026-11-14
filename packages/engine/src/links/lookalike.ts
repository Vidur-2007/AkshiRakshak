/**
 * Lookalike detection (SPEC_A_ENGINE.md §6.2 step 4) and the character-level diff for B's
 * URL anatomy view.
 *
 * A domain imitates a brand when (a) its label contains a brand token but the domain is not
 * official ("sbi-kyc-update.xyz"), (b) its label, after the homoglyph map, is within
 * Damerau-Levenshtein distance 1 (5-letter tokens) or 2 (longer) of a brand token
 * ("hdfcbenk"), or equals the token on another suffix ("icicibank.xyz"), or (c) a brand token
 * is a subdomain label of an unrelated domain ("sbi.secure-login.top").
 * Tokens of up to four letters (sbi, pnb, hdfc, trai) only match exactly — distance 1 matches noise.
 */
import { BRANDS, HOMOGLYPH_SEQUENCES, HOMOGLYPHS, NOT_LOOKALIKE, type Brand } from './registry';

/** Optimal-string-alignment Damerau-Levenshtein distance. */
export function osaDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const d: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const row = d[i]!;
      const prev = d[i - 1]!;
      let v = Math.min(prev[j]! + 1, row[j - 1]! + 1, prev[j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
        v = Math.min(v, d[i - 2]![j - 2]! + 1);
      row[j] = v;
    }
  }
  return d[m]![n]!;
}

/** Character-level diff of `actual` against `expected` (substitutions, insertions, deletions, swaps). */
export function charDiff(
  actual: string,
  expected: string,
  offset = 0,
): { index: number; expected: string; actual: string }[] {
  const a = [...actual];
  const e = [...expected];
  const m = a.length;
  const n = e.length;
  const d: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === e[j - 1] ? 0 : 1;
      let v = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === e[j - 2] && a[i - 2] === e[j - 1])
        v = Math.min(v, d[i - 2]![j - 2]! + 1);
      d[i]![j] = v;
    }
  }
  const out: { index: number; expected: string; actual: string }[] = [];
  let i = m;
  let j = n;
  // UTF-16 offset of code point k in `actual`
  const pos = (k: number) => offset + a.slice(0, k).join('').length;
  while (i > 0 || j > 0) {
    const cur = d[i]![j]!;
    if (
      i > 1 &&
      j > 1 &&
      a[i - 1] === e[j - 2] &&
      a[i - 2] === e[j - 1] &&
      a[i - 1] !== a[i - 2] &&
      cur === d[i - 2]![j - 2]! + 1
    ) {
      out.push({
        index: pos(i - 2),
        expected: `${e[j - 2]}${e[j - 1]}`,
        actual: `${a[i - 2]}${a[i - 1]}`,
      });
      i -= 2;
      j -= 2;
    } else if (i > 0 && j > 0 && cur === d[i - 1]![j - 1]! + (a[i - 1] === e[j - 1] ? 0 : 1)) {
      if (a[i - 1] !== e[j - 1])
        out.push({ index: pos(i - 1), expected: e[j - 1]!, actual: a[i - 1]! });
      i--;
      j--;
    } else if (i > 0 && cur === d[i - 1]![j]! + 1) {
      out.push({ index: pos(i - 1), expected: '', actual: a[i - 1]! }); // extra character
      i--;
    } else {
      out.push({ index: pos(i), expected: e[j - 1]!, actual: '' }); // missing character
      j--;
    }
  }
  return out.reverse();
}

/** Candidate ASCII forms of a label after the homoglyph map (1 tried as both l and i). */
export function homoglyphForms(label: string): string[] {
  const single = (oneAs: string) =>
    [...label.toLowerCase()].map((c) => (c === '1' ? oneAs : (HOMOGLYPHS[c] ?? c))).join('');
  const forms = new Set<string>([label.toLowerCase(), single('l'), single('i')]);
  for (const f of [...forms]) {
    let g = f;
    for (const [from, to] of HOMOGLYPH_SEQUENCES) g = g.split(from).join(to);
    forms.add(g);
  }
  return [...forms];
}

export interface LookalikeMatch {
  brand: Brand;
  /** official domain shown as "looks like" */
  lookalikeOf: string;
  rule: 'contains' | 'distance' | 'subdomain' | 'homoglyph';
  diff?: { index: number; expected: string; actual: string }[];
}

/** Tokens of ≤ 4 letters match only exactly (distance 1 on "trai" or "hdfc" matches ordinary words). */
const allowedDistance = (len: number) => (len <= 4 ? 0 : len === 5 ? 1 : 2);

/** Split a label into parts on hyphens, dots and digit runs ("sbi-kyc2update" → sbi, kyc, update). */
const parts = (label: string) => label.split(/[-._]+|\d+/).filter(Boolean);

function officialLabel(brand: Brand, token: string): string {
  // the official domain whose first label is closest to the token, for "looks like" display
  let best = brand.domains[0] ?? token;
  let bestD = Infinity;
  for (const d of brand.domains) {
    const dd = osaDistance(d.split('.')[0] ?? d, token);
    if (dd < bestD) {
      best = d;
      bestD = dd;
    }
  }
  return best;
}

/**
 * Find the brand a domain imitates. `label` is the registrable label without suffix (Unicode),
 * `subdomain` the labels before it, `labelOffset` where `label` starts in the host (for diffs).
 * Returns null for official domains (the caller checks those first) and allowlisted ones.
 */
export function findLookalike(
  registrableDomain: string,
  label: string,
  subdomain: string,
  labelOffset: number,
): LookalikeMatch | null {
  if (NOT_LOOKALIKE.has(registrableDomain) || !label) return null;
  const forms = homoglyphForms(label);
  const hasHomoglyph = forms.some((f) => f !== label.toLowerCase()) && /[^a-z0-9-]/i.test(label);
  let best: { m: LookalikeMatch; score: number } | null = null;
  const consider = (m: LookalikeMatch, score: number) => {
    if (!best || score < best.score) best = { m, score };
  };

  for (const brand of BRANDS) {
    for (const token of brand.tokens) {
      if (!token) continue;
      for (const form of forms) {
        // (b) distance, homoglyph or same label on another suffix
        const dist = osaDistance(form, token);
        // typosquats keep the first letter and roughly the length; this avoids "train" ≈ "trai"
        const plausible =
          dist === 0 || (form[0] === token[0] && Math.abs(form.length - token.length) <= 2);
        if (plausible && dist <= allowedDistance(token.length)) {
          const rule = hasHomoglyph || form !== label.toLowerCase() ? 'homoglyph' : 'distance';
          const official = officialLabel(brand, token);
          const officialFirst = official.split('.')[0] ?? token;
          const target =
            osaDistance(label.toLowerCase(), officialFirst) <=
            osaDistance(label.toLowerCase(), token)
              ? officialFirst
              : token;
          consider(
            {
              brand,
              lookalikeOf: official,
              rule,
              diff: charDiff(label.toLowerCase(), target, labelOffset),
            },
            dist,
          );
        }
        // (a) label contains the token
        const p = parts(form);
        const contains = token.length <= 4 ? p.includes(token) : form.includes(token);
        if (contains && form !== token)
          consider({ brand, lookalikeOf: officialLabel(brand, token), rule: 'contains' }, 3);
      }
      // (c) token as a subdomain label of an unrelated domain
      if (subdomain && subdomain.split('.').some((s) => s === token || parts(s).includes(token))) {
        consider({ brand, lookalikeOf: officialLabel(brand, token), rule: 'subdomain' }, 4);
      }
    }
  }
  return (best as { m: LookalikeMatch } | null)?.m ?? null;
}
