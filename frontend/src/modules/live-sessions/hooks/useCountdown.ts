import { useEffect, useState } from "react";

/**
 * Countdown to a server-provided deadline (ISO string). Ticks 4×/second for a
 * smooth ring, returning whole seconds remaining (never negative).
 */
export function useCountdown(endsAtIso: string | null): number {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!endsAtIso) {
      setRemaining(0);
      return;
    }
    const deadline = new Date(endsAtIso).getTime();
    const compute = () => Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    setRemaining(compute());
    const timer = setInterval(() => setRemaining(compute()), 250);
    return () => clearInterval(timer);
  }, [endsAtIso]);

  return remaining;
}
