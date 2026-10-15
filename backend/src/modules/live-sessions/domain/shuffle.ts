/**
 * Deterministic seeded shuffles for live sessions.
 *
 * Ported from the MIT-licensed `quizz` project (see docs/quizz-integration.md).
 *
 * Every permutation is derived purely from a numeric seed (the session id), so
 * it is stable across reconnects and server restarts without storing per-player
 * presentation state. Do NOT replace the seed with `Math.random()`: the answer
 * option order sent to clients must be reproducible when the engine rebuilds a
 * question after a restart.
 */

/** Small, fast, deterministic PRNG (mulberry32). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Permutation of `n` items. Returns `perm` where `perm[displaySlot]` is the
 * original index shown at that slot. For n > 1 the result never equals the
 * identity, so an ordering question is not presented pre-solved.
 */
export function seededPerm(n: number, seed: number): number[] {
  if (n <= 1) return Array.from({ length: n }, (_, i) => i);
  const rng = mulberry32(seed + 1);
  for (let attempt = 0; attempt < 8; attempt++) {
    const a = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = a[i] as number;
      a[i] = a[j] as number;
      a[j] = tmp;
    }
    if (a.some((value, index) => value !== index)) return a;
  }
  return Array.from({ length: n }, (_, i) => (i + 1) % n);
}

/**
 * Plain seeded Fisher-Yates permutation. The identity is a valid outcome — this
 * is what answer-option shuffling uses so a two-option question is not always
 * presented reversed.
 */
export function seededShuffle(n: number, seed: number): number[] {
  if (n <= 1) return Array.from({ length: n }, (_, i) => i);
  const rng = mulberry32(seed);
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = a[i] as number;
    a[i] = a[j] as number;
    a[j] = tmp;
  }
  return a;
}

/** Invert a permutation: `invertPerm(perm)[originalIndex] === displaySlot`. */
export function invertPerm(perm: number[]): number[] {
  const inverse = new Array<number>(perm.length).fill(-1);
  perm.forEach((original, slot) => {
    inverse[original] = slot;
  });
  return inverse;
}

/** Stable 32-bit hash of a string, used to seed from a UUID. */
export function hashSeed(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (Math.imul(31, hash) + value.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
}
