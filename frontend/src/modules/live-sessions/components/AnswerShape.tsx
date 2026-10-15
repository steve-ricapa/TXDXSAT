import type { AnswerShapeName } from "../lib/answer-style";

/**
 * Geometric answer markers (triangle, diamond, circle, square).
 *
 * Drawn as inline SVG using `currentColor` so they inherit the surrounding text
 * colour and stay crisp at any size.
 */
export function AnswerShape({
  shape,
  className = "h-8 w-8",
}: {
  shape: AnswerShapeName;
  className?: string;
}) {
  const common = { viewBox: "0 0 32 32", className, "aria-hidden": true as const };
  switch (shape) {
    case "triangle":
      return (
        <svg {...common}>
          <polygon points="16,3 30,28 2,28" fill="currentColor" />
        </svg>
      );
    case "diamond":
      return (
        <svg {...common}>
          <polygon points="16,2 30,16 16,30 2,16" fill="currentColor" />
        </svg>
      );
    case "circle":
      return (
        <svg {...common}>
          <circle cx="16" cy="16" r="13" fill="currentColor" />
        </svg>
      );
    case "square":
      return (
        <svg {...common}>
          <rect x="4" y="4" width="24" height="24" rx="3" fill="currentColor" />
        </svg>
      );
  }
}
