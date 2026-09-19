import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv } from "vite"
import { inspectAttr } from 'plugin-inspect-react-code'

const SERVER_ENV_KEYS = [
  'TYPESAFE_API_KEY',
  'OPENROUTER_API_KEY',
  'JEV_PROVIDER',
  'JEV_MODEL',
  'JEV_TIMEOUT_MS',
  'JEV_CONFIDENCE_MIN',
  'TRUSTED_PROXIES',
] as const

// https://vite.dev/config/
export default defineConfig(({ isSsrBuild, mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  for (const key of SERVER_ENV_KEYS) {
    const value = env[key]?.trim()
    if (value && process.env[key] === undefined) process.env[key] = value
  }

  return {
    base: './',
    plugins: isSsrBuild ? [] : [inspectAttr(), react(), {
      name: 'online-rooms',
      async configureServer(server) {
        const { createApiHandler } = await server.ssrLoadModule('/server/http.ts');
        const api = createApiHandler();
        server.middlewares.use((req, res, next) => {
          if (req.url?.startsWith('/api/')) void api(req, res);
          else next();
        });
      },
    }],
    server: {
      port: 3000,
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
