/**
 * Brand claims and claims-vs-reality (SPEC_A_ENGINE.md §8.5). P2: detect brand claims from the
 * registry in links/registry.ts, compare with link domains, UPI handles and sender domains, and
 * build localised ClaimCheck entries. P1 returns none.
 */
import type { BrandClaim, ClaimCheck, Entities, Lang } from '@akshi/contracts';

export function detectBrands(_text: string): BrandClaim[] {
  return [];
}

export function claimsVsReality(_entities: Entities, _lang: Lang): ClaimCheck[] {
  return [];
}
