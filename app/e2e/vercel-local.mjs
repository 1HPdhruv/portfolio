// Serves `vercel build` output (.vercel/output) locally with its generated routes applied, so routing and
// headers can be checked before any upload. An approximation of Vercel's Build Output API v3 (static only):
// main-phase routes (redirects, headers), then the filesystem with `overrides`, then error routes.
// usage: VERCEL_TELEMETRY_DISABLED=1 vercel build && node e2e/vercel-local.mjs [port=4330]
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';

const out = '.vercel/output', root = join(out, 'static');
const cfg = JSON.parse(readFileSync(join(out, 'config.json'), 'utf8'));
const port = Number(process.argv[2] ?? 4330);
const byPath = new Map(Object.entries(cfg.overrides ?? {}).map(([file, o]) => [o.path, { file, type: o.contentType }]));
const errIdx = cfg.routes.findIndex((r) => r.handle === 'error');
const main = cfg.routes.slice(0, errIdx < 0 ? undefined : errIdx).filter((r) => !r.handle);
const errors = errIdx < 0 ? [] : cfg.routes.slice(errIdx + 1);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml', '.json': 'application/json' };
const sub = (s, m) => s.replace(/\$(\d)/g, (_, i) => m[+i] ?? '');

function lookup(p) {
  const key = p.replace(/^\//, '') || 'index'; // the site root is the `index` override
  if (byPath.has(key)) return { file: join(root, byPath.get(key).file), type: byPath.get(key).type };
  const f = join(root, key);
  if (key && existsSync(f) && statSync(f).isFile()) return { file: f };
  return null;
}

createServer((req, res) => {
  const url = new URL(req.url, 'http://x'); const p = decodeURIComponent(url.pathname);
  const headers = {};
  for (const r of main) {
    const m = new RegExp(r.src).exec(p); if (!m) continue;
    for (const [k, v] of Object.entries(r.headers ?? {})) headers[k.toLowerCase()] = sub(v, m);
    if (r.status >= 300 && r.status < 400) { res.writeHead(r.status, { ...headers, location: headers.location + url.search }); return res.end(); }
    if (!r.continue) break;
  }
  let hit = lookup(p), status = 200;
  if (!hit) { for (const r of errors) { const m = new RegExp(r.src).exec(p); if (m) { hit = lookup(r.dest); status = r.status ?? 404; break; } } }
  if (!hit) { res.writeHead(404, headers); return res.end('not found'); }
  res.writeHead(status, { ...headers, 'content-type': hit.type ?? TYPES[extname(hit.file)] ?? 'application/octet-stream' });
  res.end(readFileSync(hit.file));
}).listen(port, '127.0.0.1', () => console.log(`vercel-local: serving ${root} with ${main.length} routes on http://127.0.0.1:${port}`));
