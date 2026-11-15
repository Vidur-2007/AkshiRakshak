/**
 * Upstash Redis over its REST API (SPEC_A_ENGINE.md §12.5), added through the Vercel Marketplace.
 * The integration injects either KV_REST_API_URL / KV_REST_API_TOKEN or UPSTASH_REDIS_REST_URL /
 * UPSTASH_REDIS_REST_TOKEN — both are read here, in this one module. Plain fetch, no SDK.
 */

export interface RedisConfig {
  url: string;
  token: string;
}

export function redisConfig(env: NodeJS.ProcessEnv = process.env): RedisConfig | null {
  const url = env.UPSTASH_REDIS_REST_URL ?? env.KV_REST_API_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN ?? env.KV_REST_API_TOKEN;
  return url && token ? { url: url.replace(/\/+$/, ''), token } : null;
}

export type RedisCommand = (string | number)[];
export type RedisFetch = (url: string, init: RequestInit) => Promise<Response>;

/** Runs commands in one pipeline request; returns each command's result (throws on errors). */
export async function redisPipeline(
  cfg: RedisConfig,
  commands: RedisCommand[],
  fetchImpl: RedisFetch = fetch,
): Promise<unknown[]> {
  const res = await fetchImpl(`${cfg.url}/pipeline`, {
    method: 'POST',
    headers: { authorization: `Bearer ${cfg.token}`, 'content-type': 'application/json' },
    body: JSON.stringify(commands),
    signal: AbortSignal.timeout(3_000),
  });
  if (!res.ok) throw new Error(`redis ${res.status}`);
  const out = (await res.json()) as { result?: unknown; error?: string }[];
  return out.map((r) => {
    if (r.error) throw new Error('redis command failed');
    return r.result;
  });
}
