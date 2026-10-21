import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/**
 * Vite configuration.
 *
 * The application is deployed under the public prefix `/sat` (set via
 * `VITE_BASE_PATH`). Everything derives from that base so routing, API calls and
 * the Socket.IO endpoint keep working behind the Nginx reverse proxy — in dev the
 * Vite dev server proxies `/sat/api` and `/sat/socket.io` to the backend.
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const base = env["VITE_BASE_PATH"] || "/sat/";
  const apiTarget = env["VITE_DEV_API_TARGET"] || "http://localhost:4000";
  const stripBase = (path: string): string => path.replace(base.replace(/\/$/, ""), "") || "/";
  const baseWithoutSlash = base.replace(/\/+$/, "");

  return {
    base,
    plugins: [
      react(),
      tailwindcss(),
      {
        name: "redirect-base-without-trailing-slash",
        configureServer(server) {
          server.middlewares.use((request, response, next) => {
            const requestUrl = request.url ?? "/";
            const [pathname, query = ""] = requestUrl.split("?", 2);
            if (pathname === baseWithoutSlash) {
              response.statusCode = 302;
              response.setHeader("Location", `${base}${query ? `?${query}` : ""}`);
              response.end();
              return;
            }
            next();
          });
        },
      },
    ],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    server: {
      host: true,
      port: 5173,
      strictPort: true,
      proxy: {
        [`${base}api`]: {
          target: apiTarget,
          changeOrigin: true,
          rewrite: stripBase,
        },
        [`${base}socket.io`]: {
          target: apiTarget,
          changeOrigin: true,
          ws: true,
          rewrite: stripBase,
        },
      },
    },
    build: {
      outDir: "dist",
      sourcemap: false,
      target: "es2022",
    },
  };
});
