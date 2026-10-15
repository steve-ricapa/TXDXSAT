import { useEffect, useRef, useState } from "react";

/** One observer per visual; expensive loops only run when the visual is on screen. */
export function useLandingMotion<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(false);
  const [reduced, setReduced] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    media.addEventListener("change", update);
    const node = ref.current;
    if (!node || !("IntersectionObserver" in window)) {
      setVisible(true);
      return () => media.removeEventListener("change", update);
    }
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      threshold: 0.08,
      rootMargin: "80px 0px",
    });
    observer.observe(node);
    return () => {
      observer.disconnect();
      media.removeEventListener("change", update);
    };
  }, []);

  return { ref, visible, reduced, active: visible && !reduced };
}
