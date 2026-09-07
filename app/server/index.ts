import { createServer } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApiHandler } from './http';
import { createStaticHandler } from './staticFiles';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../dist');
const api = createApiHandler();
const staticFiles = createStaticHandler(root);

const server = createServer(async (request, response) => {
  if (request.url?.startsWith('/api/')) return api(request, response);
  await staticFiles(request, response);
});

const port = Number(process.env.PORT ?? 3000);
server.requestTimeout = 10_000;
server.listen(port, process.env.HOST ?? '0.0.0.0', () => {
  console.log(`Buckshot Roulette: http://localhost:${port}`);
});
