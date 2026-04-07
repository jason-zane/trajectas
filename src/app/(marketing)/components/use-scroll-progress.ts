"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Returns a normalised 0-1 scroll progress value for the given element.
 * 0 = element top enters viewport bottom, 1 = element bottom exits viewport top.
 */
export function useScrollProgress() {
  const ref = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const ticking = useRef(false);

  useEffect(() => {
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (prefersReduced) return;

    function handleScroll() {
      if (ticking.current) return;
      ticking.current = true;

      requestAnimationFrame(() => {
        if (!ref.current) {
          ticking.current = false;
          return;
        }
        const rect = ref.current.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const totalScrollDistance = rect.height - viewportHeight;

        if (totalScrollDistance <= 0) {
          const raw = 1 - (rect.top / viewportHeight);
          setProgress(Math.max(0, Math.min(1, raw)));
        } else {
          const raw = -rect.top / totalScrollDistance;
          setProgress(Math.max(0, Math.min(1, raw)));
        }

        ticking.current = false;
      });
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return { ref, progress };
}
