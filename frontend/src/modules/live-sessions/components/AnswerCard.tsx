import type { ReactNode } from "react";
import { paletteFor, slotLabel } from "../lib/answer-style";
import { resolveMediaUrl } from "../lib/media";
import { AnswerShape } from "./AnswerShape";

export type AnswerState = "idle" | "selected" | "correct" | "wrong" | "dimmed";

export interface AnswerCardProps {
  slot: number;
  text: string;
  imageUrl?: string | null;
  variant?: "player" | "presenter";
  state?: AnswerState;
  /** Vote count for the reveal overlay (presenter only). */
  votes?: number;
  maxVotes?: number;
  showVotes?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  /** Stagger index for entry animation. */
  index?: number;
  className?: string;
}

/**
 * The workhorse of the game surface: one big coloured answer tile with its shape
 * marker. Shared by the participant pad and the projector board so both always
 * agree on colour/shape/text.
 */
export function AnswerCard({
  slot,
  text,
  imageUrl,
  variant = "presenter",
  state = "idle",
  votes = 0,
  maxVotes = 1,
  showVotes = false,
  onClick,
  disabled = false,
  index = 0,
  className = "",
}: AnswerCardProps) {
  const palette = paletteFor(slot);
  const resolvedImage = resolveMediaUrl(imageUrl ?? null);
  const isPlayer = variant === "player";

  const stateClasses =
    state === "dimmed" || state === "wrong"
      ? "opacity-45 saturate-50"
      : state === "correct"
        ? "ring-4 ring-white/90"
        : state === "selected"
          ? "ring-4 ring-white scale-[1.02]"
          : "";

  const interactive = Boolean(onClick) && !disabled;
  const Tag = interactive ? "button" : "div";
  const barWidth = maxVotes > 0 ? Math.round((votes / maxVotes) * 100) : 0;

  const content: ReactNode = (
    <>
      {showVotes && votes > 0 && (
        <span
          className="absolute inset-y-0 left-0 bg-black/30 transition-[width] duration-700 ease-out"
          style={{ width: `${barWidth}%` }}
          aria-hidden
        />
      )}

      <span className="relative flex w-full items-center gap-3 sm:gap-4">
        <AnswerShape
          shape={palette.shape}
          className={isPlayer ? "h-9 w-9 shrink-0 sm:h-11 sm:w-11" : "h-7 w-7 shrink-0 sm:h-9 sm:w-9"}
        />

        {resolvedImage && (
          <img
            src={resolvedImage}
            alt=""
            className={
              isPlayer
                ? "h-16 w-16 shrink-0 rounded-lg bg-white/20 object-cover sm:h-20 sm:w-20"
                : "h-14 w-14 shrink-0 rounded-lg bg-white/20 object-cover sm:h-16 sm:w-16"
            }
          />
        )}

        <span
          className={`flex-1 text-left font-extrabold leading-tight drop-shadow-sm ${
            isPlayer ? "text-lg sm:text-2xl" : "text-xl sm:text-2xl xl:text-3xl"
          }`}
        >
          {text}
        </span>

        {showVotes && (
          <span className="relative shrink-0 rounded-full bg-black/35 px-3 py-1 text-sm font-bold tabular-nums sm:text-base">
            {votes}
          </span>
        )}
      </span>
    </>
  );

  const base = `relative flex w-full items-center overflow-hidden rounded-2xl px-4 py-4 text-white transition-all duration-200 ${
    isPlayer ? "min-h-[84px] sm:min-h-[104px]" : "py-5"
  }`;

  if (Tag === "button") {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        style={{ ["--i" as string]: index }}
        className={`stagger ${base} ${palette.bg} ${state === "idle" ? palette.lip : ""} ${stateClasses} ${
          interactive ? "cursor-pointer active:translate-y-0.5 active:shadow-none hover:brightness-110" : ""
        } ${className}`}
      >
        {content}
      </button>
    );
  }

  return (
    <div
      style={{ ["--i" as string]: index }}
      className={`stagger ${base} ${palette.bg} ${palette.lip} ${stateClasses} ${className}`}
    >
      {content}
    </div>
  );
}

/** Small A/B/C/D chip used in dense lists. */
export function SlotChip({ slot }: { slot: number }) {
  const palette = paletteFor(slot);
  return (
    <span
      className="inline-flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold text-white"
      style={{ backgroundColor: palette.hex }}
    >
      {slotLabel(slot)}
    </span>
  );
}
