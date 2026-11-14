/**
 * Local API server (SPEC.md §10): serves the Vercel Functions in api/ on port 3001.
 * Maps /api/<path> → api/<path>.ts and calls the exported GET/POST/... Web handler,
 * converting node:http requests to Request and Responses back.
 * Run: npm run dev:api   (Vite on Laptop B proxies /api here)
 */
import { existsSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { fileURLToPath, pathToFileURL } from 'node:url';

const PORT = Number(process.env.PORT ?? 3001);
const API_DIR = fileURLToPath(new URL('../api/', import.meta.url));
const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const;
type Handler = (request: Request) => Response | Promise<Response>;

// Load .env if present (never committed). Node ≥ 20.12 has process.loadEnvFile.
if (existsSync('.env')) {
  try {
    process.loadEnvFile('.env');
  } catch (err) {
    console.warn('[dev-api] could not read .env:', (err as Error).message);
  }
}

async function loadHandlers(route: string): Promise<Record<string, unknown> | null> {
  if (!/^[a-z0-9-]+(?:\/[a-z0-9-]+)*$/.test(route)) return null; // no traversal, no dotfiles
  const file = `${API_DIR}${route}.ts`;
  if (!existsSync(file)) return null;
  // Re-import on every request in dev so edits apply without a restart.
  return (await import(`${pathToFileURL(file).href}?t=${Date.now()}`)) as Record<string, unknown>;
}

async function readBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

const server = createServer(async (req, res) => {
  const started = Date.now();
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? `localhost:${PORT}`}`);
  const method = (req.method ?? 'GET').toUpperCase();
  try {
    const match = /^\/api\/(.+?)\/?$/.exec(url.pathname);
    const mod = match?.[1] ? await loadHandlers(match[1]) : null;
    if (!mod) {
      sendJson(res, 404, { error: { code: 'bad_request', message: 'Not found' } });
      return;
    }
    const handler = mod[method];
    if (typeof handler !== 'function') {
      const allow = METHODS.filter((m) => typeof mod[m] === 'function').join(', ');
      res.setHeader('allow', allow);
      sendJson(res, 405, {
        error: { code: 'bad_request', message: `Method ${method} not allowed` },
      });
      return;
    }
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) {
      if (Array.isArray(v)) v.forEach((x) => headers.append(k, x));
      else if (v !== undefined) headers.set(k, v);
    }
    const body = method === 'GET' || method === 'HEAD' ? undefined : await readBody(req);
    const request = new Request(url, { method, headers, body });
    const response = await (handler as Handler)(request);
    const out: Record<string, string> = {};
    response.headers.forEach((v, k) => (out[k] = v));
    res.writeHead(response.status, out);
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (err) {
    console.error('[dev-api] handler error:', (err as Error).message);
    if (!res.headersSent)
      sendJson(res, 500, { error: { code: 'internal', message: 'Internal error' } });
    else res.end();
  } finally {
    // Log method, path and status only — never bodies (SPEC.md §12.1 privacy).
    console.log(
      `[dev-api] ${method} ${url.pathname} → ${res.statusCode} (${Date.now() - started} ms)`,
    );
  }
});

server.listen(PORT, () => console.log(`[dev-api] serving api/ on http://localhost:${PORT}/api`));
