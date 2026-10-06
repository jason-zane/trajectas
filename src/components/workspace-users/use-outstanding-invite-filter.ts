"use client";

import { useEffect, useState } from "react";
import type { OutstandingInviteFilter } from "./outstanding-invites-header";

const REVEAL_EVENT = "trajectas:reveal-outstanding-invites";

/** Reset only the outstanding section on this page, without changing records. */
export function revealOutstandingInvites() {
  document.getElementById("outstanding-invites")?.dispatchEvent(new Event(REVEAL_EVENT));
}

export function useOutstandingInviteFilter() {
  const [filter, setFilter] = useState<OutstandingInviteFilter>("all");
  useEffect(() => {
    const section = document.getElementById("outstanding-invites");
    const reveal = () => setFilter("all");
    section?.addEventListener(REVEAL_EVENT, reveal);
    return () => section?.removeEventListener(REVEAL_EVENT, reveal);
  }, []);
  return [filter, setFilter] as const;
}
