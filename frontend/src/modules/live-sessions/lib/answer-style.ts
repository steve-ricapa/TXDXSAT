/**
 * Answer visual language.
 *
 * Every answer slot has a colour **and** a shape so it stays distinguishable for
 * colour-blind players and on a washed-out projector. The order and palette
 * follow the classic quiz-show convention (red triangle, blue diamond, yellow
 * circle, green square) but are TXDXSAT's own — no third-party brand assets.
 */

export type AnswerShapeName = "triangle" | "diamond" | "circle" | "square";
export type AnswerColour = "red" | "blue" | "yellow" | "green";

export interface AnswerPalette {
  colour: AnswerColour;
  shape: AnswerShapeName;
  /** Raw hex, for inline styles/SVG fills. */
  hex: string;
  /** Tailwind background utility (theme token). */
  bg: string;
  /** Softer translucent background for idle/secondary surfaces. */
  soft: string;
  /** 3D-lip shadow utility. */
  lip: string;
}

export const ANSWER_PALETTE: readonly AnswerPalette[] = [
  {
    colour: "red",
    shape: "triangle",
    hex: "#e21b3c",
    bg: "bg-answer-red",
    soft: "bg-answer-red/15",
    lip: "shadow-[0_6px_0_0_var(--color-answer-red-dark)]",
  },
  {
    colour: "blue",
    shape: "diamond",
    hex: "#1368ce",
    bg: "bg-answer-blue",
    soft: "bg-answer-blue/15",
    lip: "shadow-[0_6px_0_0_var(--color-answer-blue-dark)]",
  },
  {
    colour: "yellow",
    shape: "circle",
    hex: "#d89e00",
    bg: "bg-answer-yellow",
    soft: "bg-answer-yellow/15",
    lip: "shadow-[0_6px_0_0_var(--color-answer-yellow-dark)]",
  },
  {
    colour: "green",
    shape: "square",
    hex: "#26890c",
    bg: "bg-answer-green",
    soft: "bg-answer-green/15",
    lip: "shadow-[0_6px_0_0_var(--color-answer-green-dark)]",
  },
] as const;

/** Palette for a display slot (wraps after four answers). */
export function paletteFor(slot: number): AnswerPalette {
  return ANSWER_PALETTE[slot % ANSWER_PALETTE.length] as AnswerPalette;
}

/** A/B/C/D label for a display slot. */
export function slotLabel(slot: number): string {
  return String.fromCharCode(65 + slot);
}
