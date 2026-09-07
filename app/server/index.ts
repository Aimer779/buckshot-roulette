import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApiHandler } from './http';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../dist');
const api = createApiHandler();
const mime: Record<string, string> = { '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };

const server = createServer(async (request, response) => {
  if (request.url?.startsWith('/api/')) return api(request, response);
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405).end();
    return;
  }
  try {
    const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
    const file = resolve(root, `.${pathname}`);
    if (file !== root && !file.startsWith(root + sep)) {
      response.writeHead(403).end();
      return;
    }
    const target = ['/', '/online', '/play', '/tutorial', '/gameover'].includes(pathname)
      ? resolve(root, 'index.html') : file;
    const content = await readFile(target);
    response.writeHead(200, { 'Content-Type': mime[extname(target)] ?? 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff' });
    response.end(request.method === 'HEAD' ? undefined : content);
  } catch { response.writeHead(404).end('Not found'); }
});

const port = Number(process.env.PORT ?? 3000);
server.requestTimeout = 10_000;
server.listen(port, process.env.HOST ?? '0.0.0.0', () => {
  console.log(`Buckshot Roulette: http://localhost:${port}`);
});
