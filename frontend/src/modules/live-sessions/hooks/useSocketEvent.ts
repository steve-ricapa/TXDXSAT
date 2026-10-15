import { useEffect, useRef } from "react";
import type { Socket } from "socket.io-client";
import { getSocket } from "@/services/socket";

/**
 * Subscribe to a Socket.IO event for the lifetime of the component. The handler
 * is read through a ref so callers can pass an inline closure without
 * re-subscribing on every render.
 */
export function useSocketEvent<T = unknown>(
  event: string,
  handler: (payload: T) => void,
  socket: Socket = getSocket(),
): void {
  const ref = useRef(handler);
  ref.current = handler;

  useEffect(() => {
    const listener = (payload: T) => ref.current(payload);
    socket.on(event, listener as (...args: unknown[]) => void);
    return () => {
      socket.off(event, listener as (...args: unknown[]) => void);
    };
  }, [event, socket]);
}
