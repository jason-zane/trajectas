import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { logActionError } from "@/lib/security/action-errors";

export interface PublicLibraryCounts {
  capabilityCount: number;
  itemCount: number;
}

/**
 * Live counts for the public home page ("29 capabilities · 360 items") —
 * never hard-code these (PRODUCT.md: "Only what is true"). Admin client
 * because the home page has no session at all. The count is of the GLOBAL
 * library only: `factors` also holds client- and partner-owned rows
 * (client_id / partner_id), which are private to those tenants and are not
 * "the library" the page describes — so the predicate is explicit here
 * rather than trusting the table to be tenant-free (AGENTS.md, "RLS is not
 * the workspace boundary").
 *
 * Swallows failures to zero rather than throwing: this is a public marketing
 * page with no auth gate, and a DB hiccup on a vanity stat shouldn't 500 the
 * entire front door. (It's also why the e2e smoke suite — which runs with no
 * Supabase stack at all, see playwright.config.ts — can render this page.)
 */
export async function getPublicLibraryCounts(): Promise<PublicLibraryCounts> {
  try {
    const db = createAdminClient();
    const [{ count: capabilityCount }, { count: itemCount }] = await Promise.all([
      db
        .from("factors")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true)
        .is("deleted_at", null)
        .is("client_id", null)
        .is("partner_id", null),
      db.from("items").select("id", { count: "exact", head: true }).eq("status", "active").is("deleted_at", null),
    ]);
    return {
      capabilityCount: capabilityCount ?? 0,
      itemCount: itemCount ?? 0,
    };
  } catch (error) {
    logActionError("publicLibrary.getPublicLibraryCounts", error);
    return { capabilityCount: 0, itemCount: 0 };
  }
}
