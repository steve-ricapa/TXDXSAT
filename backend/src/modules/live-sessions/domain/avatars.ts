/**
 * Participant avatar catalog.
 *
 * TXDXSAT does not ship binary avatar assets (the reference project's
 * `assets/avatars` directory is not part of its repository either). Guests pick
 * from this curated, dependency-free emoji catalog instead, which keeps the
 * mobile join flow fast and avoids serving/validating user uploads.
 */

export interface AvatarDefinition {
  id: string;
  emoji: string;
  /** Tailwind-friendly hex used for the avatar chip background. */
  color: string;
}

export const AVATARS: readonly AvatarDefinition[] = [
  { id: "shield", emoji: "🛡️", color: "#2563eb" },
  { id: "lock", emoji: "🔒", color: "#7c3aed" },
  { id: "key", emoji: "🔑", color: "#d97706" },
  { id: "bug", emoji: "🐛", color: "#16a34a" },
  { id: "spy", emoji: "🕵️", color: "#db2777" },
  { id: "robot", emoji: "🤖", color: "#0891b2" },
  { id: "fox", emoji: "🦊", color: "#ea580c" },
  { id: "owl", emoji: "🦉", color: "#4f46e5" },
  { id: "panda", emoji: "🐼", color: "#334155" },
  { id: "unicorn", emoji: "🦄", color: "#c026d3" },
  { id: "rocket", emoji: "🚀", color: "#dc2626" },
  { id: "ghost", emoji: "👻", color: "#64748b" },
] as const;

const AVATAR_IDS = new Set(AVATARS.map((a) => a.id));

export const DEFAULT_AVATAR_ID = "shield";

export function isValidAvatar(id: unknown): id is string {
  return typeof id === "string" && AVATAR_IDS.has(id);
}

export function avatarOrDefault(id: unknown): string {
  return isValidAvatar(id) ? id : DEFAULT_AVATAR_ID;
}

export function avatarEmoji(id: string): string {
  return AVATARS.find((a) => a.id === id)?.emoji ?? "🛡️";
}
