"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Returns a normalised 0-1 scroll progress value for the given element.
 * 0 = element top enters viewport bottom, 1 = element bottom exits viewport top.
 */
export function useScrollProgress() {
  const elementRef = useRef<HTMLElement | null>(null);
  const ticking = useRef(false);
  const ref = useCallback((element: HTMLElement | null) => {
    elementRef.current = element;
    element?.style.setProperty("--scroll-progress", "0");
  }, []);

  useEffect(() => {
    let rafId = 0;
    elementRef.current?.style.setProperty("--scroll-progress", "0");

    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (prefersReduced) {
      elementRef.current?.style.setProperty("--scroll-progress", "0");
      return;
    }

    function handleScroll() {
      if (ticking.current) return;
      ticking.current = true;

      rafId = requestAnimationFrame(() => {
        const element = elementRef.current;
        if (!element) {
          ticking.current = false;
          return;
        }
        const rect = element.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const totalScrollDistance = rect.height - viewportHeight;
        const raw =
          totalScrollDistance <= 0
            ? 1 - rect.top / viewportHeight
            : -rect.top / totalScrollDistance;
        const clamped = Math.max(0, Math.min(1, raw));

        element.style.setProperty("--scroll-progress", clamped.toFixed(4));
        ticking.current = false;
      });
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => {
      window.removeEventListener("scroll", handleScroll);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return { ref };
}
