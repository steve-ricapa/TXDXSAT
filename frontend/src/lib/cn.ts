/** Tiny classname combiner (no runtime dependency needed). */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
