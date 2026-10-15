import { env } from "@/lib/env";
import { cn } from "@/lib/cn";

const base = env.basePath.replace(/\/$/, "");
/** Provided emblem, served from `public/brand` (base-path aware). */
const EMBLEM_LARGE = `${base}/brand/txdxsat-emblem-512.png`;
const EMBLEM_SMALL = `${base}/brand/txdxsat-emblem-128.png`;

/**
 * The provided TXDXSAT emblem, used at its natural proportions and colours.
 * Never recreated in CSS/SVG — always the real asset.
 */
export function BrandMark({
  size = 40,
  className,
  alt = "TXDXSAT",
}: {
  size?: number;
  className?: string;
  alt?: string;
}) {
  return (
    <img
      src={size > 160 ? EMBLEM_LARGE : EMBLEM_SMALL}
      width={size}
      height={size}
      alt={alt}
      className={cn("shrink-0 object-contain", className)}
      style={{ width: size, height: size }}
      draggable={false}
    />
  );
}

/**
 * Horizontal lockup: emblem + "TXDXSAT" wordmark. The emblem carries the
 * brand mark; the wordmark is set in type for legibility at small sizes.
 */
export function BrandLogo({
  size = 36,
  showWordmark = true,
  subtitle,
  className,
}: {
  size?: number;
  showWordmark?: boolean;
  subtitle?: string;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <BrandMark size={size} />
      {showWordmark && (
        <span className="leading-none">
          <span className="block text-lg font-extrabold tracking-tight text-ink">
            TXDX<span className="text-accent">SAT</span>
          </span>
          {subtitle && (
            <span className="mt-1 block text-[0.65rem] font-medium uppercase tracking-[0.2em] text-ink-soft">
              {subtitle}
            </span>
          )}
        </span>
      )}
    </span>
  );
}
