/**
 * Typed runtime environment.
 *
 * Vite exposes build-time variables through `import.meta.env`. This module is the
 * only place that reads them, so components/services depend on a typed object
 * with sensible defaults (notably deriving API and Socket.IO URLs from the
 * deployment base path `/sat/`).
 */
const baseUrl = import.meta.env.BASE_URL || "/sat/";

function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}

export interface AppEnv {
  appName: string;
  basePath: string;
  apiBaseUrl: string;
  socketUrl: string | undefined;
  socketPath: string;
  isProduction: boolean;
}

export const env: AppEnv = {
  appName: import.meta.env.VITE_APP_NAME ?? "TXDXSAT",
  basePath: baseUrl,
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? joinUrl(baseUrl, "api/v1"),
  socketUrl: import.meta.env.VITE_SOCKET_URL,
  socketPath: import.meta.env.VITE_SOCKET_PATH ?? joinUrl(baseUrl, "socket.io"),
  isProduction: import.meta.env.PROD,
};

/** Absolute URL for a frontend route, honouring the `/sat` base path. */
export function routeUrl(path: string): string {
  return joinUrl(baseUrl, path.replace(/^\//, ""));
}
