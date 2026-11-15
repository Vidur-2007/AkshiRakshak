/**
 * zod schemas for network replies, loaded on first use. Only the online paths (API health,
 * link expansion, domain age, AI, assistant) validate network data, so the offline engine core
 * ships without zod and the browser bundle stays small. Data still crosses the network boundary
 * through zod, as CLAUDE.md requires.
 */
import type * as Schemas from '@akshi/contracts/schemas';

let loading: Promise<typeof Schemas> | null = null;

export function netSchemas(): Promise<typeof Schemas> {
  loading ??= import('@akshi/contracts/schemas');
  return loading;
}
