"use client";

import { useEffect } from "react";

/**
 * Forces light theme on the assessment runner regardless of system preference.
 * Removes the `dark` class added by next-themes and restores it on unmount
 * (when navigating away from /assess routes back to the dashboard).
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
