import type { IncomingMessage, ServerResponse } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { pipeline } from 'node:stream/promises';

const mime: Record<string, string> = { '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
const routes = new Set(['/', '/online', '/play', '/tutorial', '/gameover']);

export function createStaticHandler(directory: string) {
  const root = resolve(directory);
  return async (request: IncomingMessage, response: ServerResponse) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { Allow: 'GET, HEAD' }).end();
      return;
    }
    try {
      const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
      if (pathname.includes('\\')) { response.writeHead(403).end(); return; }
      const file = resolve(root, `.${pathname}`);
      if (file !== root && !file.startsWith(root + sep)) {
        response.writeHead(403).end();
        return;
      }
      const target = routes.has(pathname) ? resolve(root, 'index.html') : file;
      const info = await stat(target);
      if (!info.isFile()) { response.writeHead(404).end(); return; }
      const etag = `W/"${info.size.toString(16)}-${info.mtimeMs.toString(16)}"`;
      const immutable = /^\/assets\/[^/]+-[a-zA-Z0-9_-]{8,}\.[a-zA-Z0-9]+$/.test(pathname);
      const headers = { 'Content-Type': mime[extname(target)] ?? 'application/octet-stream',
        'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'public, max-age=0, must-revalidate',
        ETag: etag, 'Last-Modified': info.mtime.toUTCString(), 'X-Content-Type-Options': 'nosniff' };
      const noneMatch = request.headers['if-none-match'];
      const modifiedSince = request.headers['if-modified-since'];
      const unchanged = noneMatch !== undefined
        ? noneMatch.split(',').some(value => value.trim() === '*' || value.trim().replace(/^W\//, '') === etag.replace(/^W\//, ''))
        : modifiedSince !== undefined && Math.floor(info.mtimeMs / 1000) * 1000 <= Date.parse(modifiedSince);
      if (unchanged) { response.writeHead(304, headers).end(); return; }
      response.writeHead(200, { ...headers, 'Content-Length': info.size });
      if (request.method === 'HEAD') { response.end(); return; }
      await pipeline(createReadStream(target), response);
    } catch {
      if (!response.headersSent) response.writeHead(404).end('Not found');
      else response.destroy();
    }
  };
}
