/**
 * Avatar catalog (client mirror of `backend/.../domain/avatars.ts`).
 * Keep the `id` values in sync — the server rejects unknown ids.
 */
export interface AvatarDefinition {
  id: string;
  emoji: string;
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
];

export const DEFAULT_AVATAR_ID = "shield";

export function avatarById(id: string | undefined): AvatarDefinition {
  return AVATARS.find((a) => a.id === id) ?? AVATARS[0]!;
}
