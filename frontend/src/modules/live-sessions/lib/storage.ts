/**
 * Per-device credential storage for live sessions.
 *
 * - Players keep their `playerId` so a refresh reconnects to the *same* player
 *   (no duplicate rows, no lost score).
 * - Hosts keep their `hostToken`/`viewToken` so the control and presenter views
 *   survive a reload. Tokens are never shown to players.
 */

const PLAYER_PREFIX = "txdxsat:live:player:";
const HOST_PREFIX = "txdxsat:live:host:";

export interface StoredPlayer {
  playerId: string;
  userId: string;
  sessionId: string;
  pin: string;
  username: string;
  avatar: string;
}

export interface StoredHost {
  sessionId: string;
  pin: string;
  hostToken: string;
  viewToken: string;
  quizTitle: string;
}

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export const playerStore = {
  save(player: StoredPlayer): void {
    localStorage.setItem(`${PLAYER_PREFIX}${player.sessionId}`, JSON.stringify(player));
  },
  load(sessionId: string): StoredPlayer | null {
    return read<StoredPlayer>(`${PLAYER_PREFIX}${sessionId}`);
  },
  clear(sessionId: string): void {
    localStorage.removeItem(`${PLAYER_PREFIX}${sessionId}`);
  },
};

export const hostStore = {
  save(host: StoredHost): void {
    localStorage.setItem(`${HOST_PREFIX}${host.sessionId}`, JSON.stringify(host));
  },
  load(sessionId: string): StoredHost | null {
    return read<StoredHost>(`${HOST_PREFIX}${sessionId}`);
  },
  clear(sessionId: string): void {
    localStorage.removeItem(`${HOST_PREFIX}${sessionId}`);
  },
};
