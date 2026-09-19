import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ENV_FILES = ['.env.local', '.env'] as const;

function parseEnvFile(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim(); // trim so `KEY= value` still works
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

/**
 * Load `.env.local` then `.env` from cwd and the app root (parent of server-dist).
 * Existing process.env wins. Never copies VITE_ keys into a client bundle.
 */
export function loadAppEnv() {
  const here = dirname(fileURLToPath(import.meta.url));
  const dirs = new Set([process.cwd(), resolve(here, '..')]);
  for (const dir of dirs) {
    for (const name of ENV_FILES) {
      const file = resolve(dir, name);
      if (!existsSync(file)) continue;
      const parsed = parseEnvFile(readFileSync(file, 'utf8'));
      for (const [key, value] of Object.entries(parsed)) {
        if (process.env[key] === undefined) process.env[key] = value;
      }
    }
  }
}
