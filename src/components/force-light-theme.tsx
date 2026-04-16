"use client";

import { useEffect } from "react";

/**
 * Forces light theme regardless of system/user preference.
 *
 * Mount inside a route-level `layout.tsx` to scope forced-light behaviour
 * to that sub-tree. Removes the `dark` class from <html> on mount and
 * restores it on unmount.
 *
 * Used for report review surfaces, report template builder/preview, brand
 * editors, results-viewing surfaces, and the candidate-facing assessment
 * runner — everywhere the content is designed only for light mode.
 */
export function ForceLightTheme() {
  useEffect(() => {
    const html = document.documentElement;
    const wasDark = html.classList.contains("dark");
    html.classList.remove("dark");
    html.style.colorScheme = "light";

    return () => {
      html.style.colorScheme = "";
      if (wasDark) html.classList.add("dark");
    };
  }, []);

  return null;
}
