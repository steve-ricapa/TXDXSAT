import type { PlayerSnapshot } from "./protocol";

/**
 * Session snapshots can arrive after a player-joined event when a host and a
 * participant connect at nearly the same time. Keep already observed players
 * so an older snapshot cannot make the lobby roster move backwards.
 */
export function mergePlayerSnapshots(
  current: PlayerSnapshot[],
  incoming: PlayerSnapshot[],
): PlayerSnapshot[] {
  const playersById = new Map(current.map((player) => [player.playerId, player]));
  for (const player of incoming) {
    if (!playersById.has(player.playerId)) playersById.set(player.playerId, player);
  }
  return [...playersById.values()];
}

export function upsertPlayerSnapshot(
  current: PlayerSnapshot[],
  incoming: PlayerSnapshot,
): PlayerSnapshot[] {
  return [...current.filter((player) => player.playerId !== incoming.playerId), incoming];
}
