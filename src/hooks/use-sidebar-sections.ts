"use client";

import { useCallback, useEffect, useState } from "react";

const COOKIE_PREFIX = "sidebar_sections";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

type SectionState = Record<string, boolean>;

function cookieName(portal: string) {
  return `${COOKIE_PREFIX}_${portal}`;
}

function readCookie(portal: string): SectionState {
  if (typeof document === "undefined") return {};
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${cookieName(portal)}=([^;]*)`)
  );
  if (!match) return {};
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(match[1]));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter(
        ([, v]) => typeof v === "boolean"
      )
    ) as SectionState;
  } catch {
    return {};
  }
}

/**
 * Which sidebar sections are expanded, persisted per portal.
 *
 * Defaults come from the nav definition; the cookie only records sections the
 * user has actually toggled, so changing a section's default in code still
 * takes effect for everyone who never touched it.
 *
 * Reads on mount rather than during render: the server has no cookie access
 * here, and diverging on the first paint would hydrate-mismatch.
 */
export function useSidebarSections(portal: string) {
  const [overrides, setOverrides] = useState<SectionState>({});

  useEffect(() => {
    setOverrides(readCookie(portal));
  }, [portal]);

  const setSectionOpen = useCallback(
    (label: string, open: boolean) => {
      setOverrides((prev) => {
        const next = { ...prev, [label]: open };
        document.cookie = `${cookieName(portal)}=${encodeURIComponent(
          JSON.stringify(next)
        )}; path=/; max-age=${COOKIE_MAX_AGE}`;
        return next;
      });
    },
    [portal]
  );

  const isSectionOpen = useCallback(
    (label: string, defaultOpen: boolean) => overrides[label] ?? defaultOpen,
    [overrides]
  );

  return { isSectionOpen, setSectionOpen };
}
