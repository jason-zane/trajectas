"use client";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export function getPrefersReducedMotion() {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return false;
  }

  try {
    return window.matchMedia(REDUCED_MOTION_QUERY).matches;
  } catch {
    return false;
  }
}

export function subscribePrefersReducedMotion(onChange: () => void) {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return () => {};
  }

  let mediaQuery: MediaQueryList;
  try {
    mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY);
  } catch {
    return () => {};
  }

  if (typeof mediaQuery.addEventListener === "function") {
    mediaQuery.addEventListener("change", onChange);
    return () => mediaQuery.removeEventListener("change", onChange);
  }

  // Older managed Safari/WebKit builds only expose the deprecated listener API.
  mediaQuery.addListener?.(onChange);
  return () => mediaQuery.removeListener?.(onChange);
}

export function supportsIntersectionObserver() {
  return (
    typeof window !== "undefined" &&
    typeof window.IntersectionObserver === "function"
  );
}
