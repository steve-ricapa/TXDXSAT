import { io, type Socket } from "socket.io-client";
import { env } from "@/lib/env";

/**
 * Shared Socket.IO client.
 *
 * The URL/path honour the `/sat` deployment prefix; in development the Vite dev
 * server proxies the WebSocket upgrade to the backend. One lazy singleton is
 * reused by every feature (live sessions, notifications) to avoid duplicate
 * connections.
 */
let socket: Socket | null = null;

export function getSocket(): Socket {
  if (socket) return socket;
  socket = io(env.socketUrl ?? undefined, {
    path: env.socketPath,
    transports: ["websocket", "polling"],
    withCredentials: true,
    autoConnect: true,
  });
  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}
