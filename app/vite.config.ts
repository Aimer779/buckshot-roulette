import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { inspectAttr } from 'plugin-inspect-react-code'

// https://vite.dev/config/
export default defineConfig(({ isSsrBuild }) => ({
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
}));
