"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Returns a normalised 0-1 scroll progress value for the given element.
 * 0 = element top enters viewport bottom, 1 = element bottom exits viewport top.
 */
export function useScrollProgress() {
  const elementRef = useRef<HTMLElement | null>(null);

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

    let current = 0;
    let target = 0;
    let animating = false;

    function lerpFrame() {
      const element = elementRef.current;
      if (!element) { animating = false; return; }

      current += (target - current) * 0.12;

      const settled = Math.abs(target - current) < 0.0003;
      if (settled) current = target;

      element.style.setProperty("--scroll-progress", current.toFixed(4));

      if (!settled) {
        rafId = requestAnimationFrame(lerpFrame);
      } else {
        animating = false;
      }
    }

    function handleScroll() {
      const element = elementRef.current;
      if (!element) return;

      const rect = element.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const totalScrollDistance = rect.height - viewportHeight;
      const raw =
        totalScrollDistance <= 0
          ? 1 - rect.top / viewportHeight
          : -rect.top / totalScrollDistance;
      target = Math.max(0, Math.min(1, raw));

      if (!animating) {
        animating = true;
        rafId = requestAnimationFrame(lerpFrame);
      }
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => {
      window.removeEventListener("scroll", handleScroll);
      cancelAnimationFrame(rafId);
      animating = false;
    };
  }, []);

  return { ref };
}
