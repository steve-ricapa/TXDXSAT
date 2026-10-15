/**
 * Session token store.
 *
 * The opaque bearer token returned by `POST /auth/login` is the only thing
 * persisted (in `localStorage`); the user profile is always re-fetched from the
 * server so a stale/forged local copy cannot grant access. A tiny subscription
 * lets the API client clear the session on a 401 and have the UI react.
 */
const STORAGE_KEY = "txdxsat.auth.token";

const listeners = new Set<() => void>();

function read(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

let current: string | null = read();

export function getToken(): string | null {
  return current;
}

export function setToken(next: string | null): void {
  if (next === current) return;
  current = next;
  try {
    if (next) localStorage.setItem(STORAGE_KEY, next);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage may be unavailable (private mode); keep the in-memory value */
  }
  for (const listener of listeners) listener();
}

export function subscribeToken(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
