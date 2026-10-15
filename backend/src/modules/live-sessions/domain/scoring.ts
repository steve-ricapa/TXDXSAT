/**
 * Scoring primitives for live sessions.
 *
 * Ported from the MIT-licensed `quizz` project
 * (https://github.com/Lawndlwd/quizz, commit 943b058e1772c1b0d0cc6f239f9dc2924f9cfb60)
 * and adapted to TXDXSAT conventions. See docs/quizz-integration.md for the full
 * attribution notice.
 *
 * The rules are intentionally pure functions: no I/O, no framework. The game
 * engine is the only caller and it is responsible for supplying the correct
 * aggregate inputs (e.g. how many players already answered correctly).
 */

export interface LatLng {
  lat: number;
  lng: number;
}

/** Normalise free text for comparison (Unicode, case, whitespace). */
export function normalizeText(value: string): string {
  return value.normalize("NFKC").toLowerCase().trim().replace(/\s+/g, " ");
}

const norm = normalizeText;

/** Parse a JSON value expected to be a string array; returns [] otherwise. */
export function parseStringArray(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map((item) => String(item));
  if (typeof raw !== "string") return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.map((item) => String(item)) : [];
  } catch {
    return [];
  }
}

/** Count how many blanks the player filled correctly (case/space-insensitive). */
export function matchFillBlank(
  submitted: string[],
  blanks: string[][],
): { matched: number; total: number } {
  const total = blanks.length;
  let matched = 0;
  for (let i = 0; i < total; i++) {
    const accepted = (blanks[i] ?? []).map(norm).filter((value) => value.length > 0);
    const given = norm(submitted[i] ?? "");
    if (given.length > 0 && accepted.includes(given)) matched++;
  }
  return { matched, total };
}

/**
 * Score an ordering answer. `order[k]` is the display slot the player placed at
 * final position k; `perm[slot]` is the original index shown at that slot. An
 * item is correctly placed when `perm[order[k]] === k`.
 */
export function scoreOrdering(
  order: number[],
  perm: number[],
): { matched: number; total: number } {
  const total = perm.length;
  if (order.length !== total) return { matched: 0, total };
  const seen = new Set<number>();
  let matched = 0;
  for (let k = 0; k < total; k++) {
    const slot = order[k];
    if (slot === undefined || !Number.isInteger(slot) || slot < 0 || slot >= total || seen.has(slot)) {
      return { matched: 0, total };
    }
    seen.add(slot);
    if (perm[slot] === k) matched++;
  }
  return { matched, total };
}

/**
 * Score a matching answer. `chosenSlots[leftIndex]` is the right-column display
 * slot the player linked to `leftItems[leftIndex]` (or null when unlinked);
 * `perm[slot]` is the original right-item index shown at that slot. Each right
 * slot can credit at most one left item.
 */
export function scoreMatching(
  chosenSlots: Array<number | null>,
  perm: number[],
  rightItems: string[],
  correctMatches: string[],
): { matched: number; total: number } {
  const total = correctMatches.length;
  const usedSlots = new Set<number>();
  let matched = 0;
  for (let i = 0; i < total; i++) {
    const slot = chosenSlots[i];
    if (slot === null || slot === undefined) continue;
    if (!Number.isInteger(slot) || slot < 0 || slot >= perm.length) continue;
    if (usedSlots.has(slot)) continue;
    usedSlots.add(slot);
    if (rightItems[perm[slot] ?? -1] === correctMatches[i]) matched++;
  }
  return { matched, total };
}

export function parseLatLng(raw: unknown): LatLng | null {
  const value = typeof raw === "string" ? safeJson(raw) : raw;
  if (
    value &&
    typeof value === "object" &&
    typeof (value as LatLng).lat === "number" &&
    typeof (value as LatLng).lng === "number"
  ) {
    return { lat: (value as LatLng).lat, lng: (value as LatLng).lng };
  }
  return null;
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Great-circle distance in kilometres between two coordinates. */
export function geoDistanceKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Score a geographic guess (GeoGuessr-style decay). */
export function scoreGeo(
  guess: LatLng,
  correct: LatLng,
  baseScore: number,
  correctCountBefore: number,
  totalPlayers: number,
  speedBonusMax: number,
  speedBonusMin: number,
): { score: number; isCorrect: boolean; distanceKm: number } {
  const distanceKm = geoDistanceKm(guess, correct);
  if (distanceKm <= 50) {
    const bonus = computeSpeedBonus(correctCountBefore, totalPlayers, speedBonusMax, speedBonusMin);
    return { score: baseScore + bonus, isCorrect: true, distanceKm };
  }
  return { score: Math.round(baseScore * Math.exp(-distanceKm / 1500)), isCorrect: false, distanceKm };
}

export function closestToDistance(guess: number, correct: number): number {
  return Math.abs(guess - correct);
}

export function closestToMaxDistance(correct: number, min: number, max: number): number {
  return Math.max(correct - min, max - correct, 1);
}

/** Score a `closest_to` guess: exact = full + speed bonus, else a 0.75-weighted ratio. */
export function scoreClosestToGuess(
  guess: number,
  correct: number,
  min: number,
  max: number,
  baseScore: number,
  correctCountBefore: number,
  totalPlayers: number,
  speedBonusMax: number,
  speedBonusMin: number,
): { score: number; isCorrect: boolean; distance: number } {
  const distance = closestToDistance(guess, correct);
  if (distance === 0) {
    const bonus = computeSpeedBonus(correctCountBefore, totalPlayers, speedBonusMax, speedBonusMin);
    return { score: baseScore + bonus, isCorrect: true, distance };
  }
  const maxDistance = closestToMaxDistance(correct, min, max);
  const ratio = 1 - distance / maxDistance;
  return { score: Math.max(0, Math.round(baseScore * ratio * 0.75)), isCorrect: false, distance };
}

/**
 * Order-based speed bonus. The first player to answer correctly earns
 * `maxBonus`, the last one earns `minBonus`, interpolated by how many players
 * answered correctly *before* this one. A single player always earns `maxBonus`.
 */
export function computeSpeedBonus(
  correctCountBefore: number,
  totalPlayers: number,
  maxBonus: number,
  minBonus: number,
): number {
  const bonus =
    totalPlayers <= 1
      ? maxBonus
      : Math.round(maxBonus - (maxBonus - minBonus) * (correctCountBefore / (totalPlayers - 1)));
  return Math.max(bonus, minBonus);
}

/**
 * Streak bonus applied on top of a fully-correct answer. Earned only beyond
 * `minimum` consecutive correct answers.
 */
export function computeStreakBonus(
  streak: number,
  enabled: boolean,
  minimum: number,
  base: number,
): number {
  if (!enabled || streak <= minimum) return 0;
  return (streak - minimum) * base;
}
