"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Triggers router.refresh() when the tab regains focus after being
 * away for at least `minIntervalMs`. Lets server-rendered pages
 * feel current without polling. Safe on top of any server component.
 */
export function RefreshOnFocus({
  minIntervalMs = 30_000,
}: {
  minIntervalMs?: number;
}) {
  const router = useRouter();
  const lastRefreshRef = useRef<number>(Date.now());

  useEffect(() => {
    function maybeRefresh() {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastRefreshRef.current < minIntervalMs) return;
      lastRefreshRef.current = now;
      router.refresh();
    }

    window.addEventListener("focus", maybeRefresh);
    document.addEventListener("visibilitychange", maybeRefresh);

    return () => {
      window.removeEventListener("focus", maybeRefresh);
      document.removeEventListener("visibilitychange", maybeRefresh);
    };
  }, [router, minIntervalMs]);

  return null;
}
