/**
 * The only module that talks to /api (SPEC.md §3 rule 2). Every call has a
 * timeout, honours an AbortSignal and fails silently (returns null) offline.
 */
let apiBase = '';

/** Point the engine at another API origin, e.g. 'http://localhost:3001' for Node-side eval runs. */
export function setApiBase(base: string): void {
  apiBase = base.replace(/\/+$/, '');
}

interface CallOpts {
  timeoutMs?: number;
  signal?: AbortSignal;
}

async function call(
  path: string,
  init: RequestInit,
  { timeoutMs = 3000, signal }: CallOpts,
): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const onAbort = () => ctrl.abort();
  signal?.addEventListener('abort', onAbort, { once: true });
  try {
    const res = await fetch(`${apiBase}${path}`, { ...init, signal: ctrl.signal });
    if (!res.ok) return null;
    return (await res.json()) as unknown;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

export function getJson(path: string, opts: CallOpts = {}): Promise<unknown> {
  return call(path, { method: 'GET' }, opts);
}

export function postJson(path: string, body: unknown, opts: CallOpts = {}): Promise<unknown> {
  return call(
    path,
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) },
    opts,
  );
}
