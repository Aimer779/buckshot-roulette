import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createStaticHandler } from '../staticFiles';

let server: Server | undefined;
let root: string | undefined;
afterEach(async () => {
  if (server) {
    server.closeAllConnections();
    await new Promise<void>(resolve => server!.close(() => resolve()));
    server = undefined;
  }
  if (root) {
    expect(dirname(resolve(root))).toBe(resolve(tmpdir()));
    await rm(root, { recursive: true, force: true });
    root = undefined;
  }
});

describe('production static responses', () => {
  it('caches hashed assets, revalidates HTML, supports HEAD, and confines file paths', async () => {
    root = await mkdtemp(join(tmpdir(), 'buckshot-static-'));
    await mkdir(join(root, 'assets'));
    await writeFile(join(root, 'index.html'), '<main>online</main>');
    await writeFile(join(root, 'assets', 'index-12345678.js'), 'export default 1;');
    server = createServer(createStaticHandler(root));
    await new Promise<void>(resolve => server!.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const html = await fetch(base + '/online');
    expect(html.headers.get('cache-control')).toContain('must-revalidate');
    expect(await html.text()).toContain('online');
    const cached = await fetch(base + '/online', { headers: { 'If-None-Match': html.headers.get('etag')! } });
    expect(cached.status).toBe(304);
    expect(await cached.text()).toBe('');
    const asset = await fetch(base + '/assets/index-12345678.js', { method: 'HEAD' });
    expect(asset.headers.get('cache-control')).toContain('immutable');
    expect(Number(asset.headers.get('content-length'))).toBeGreaterThan(0);
    expect(await asset.text()).toBe('');
    expect((await fetch(base + '/%2e%2e%5cprivate.txt')).status).toBe(403);
    expect((await fetch(base + '/missing.js')).status).toBe(404);
  });
});
