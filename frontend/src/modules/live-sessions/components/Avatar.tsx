import { avatarById } from "../lib/avatars";

export function Avatar({
  avatar,
  size = "md",
  ring = false,
}: {
  avatar: string;
  size?: "sm" | "md" | "lg";
  ring?: boolean;
}) {
  const def = avatarById(avatar);
  const dimensions = size === "lg" ? "h-14 w-14 text-3xl" : size === "sm" ? "h-8 w-8 text-base" : "h-10 w-10 text-xl";
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full ${dimensions} ${
        ring ? "ring-4 ring-accent/40" : ""
      }`}
      style={{ backgroundColor: `${def.color}22`, border: `2px solid ${def.color}` }}
      aria-hidden
    >
      {def.emoji}
    </span>
  );
}
