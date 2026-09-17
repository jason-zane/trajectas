import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export interface PublicLibraryCounts {
  capabilityCount: number;
  itemCount: number;
}

/**
 * Live counts for the public home page ("29 capabilities · 360 items") —
 * never hard-code these (PRODUCT.md: "Only what is true"). Admin client
 * because the home page has no session at all; safe because these are
 * aggregate counts over platform-wide reference tables (factors, items),
 * which carry no tenant rows to leak.
 */
export async function getPublicLibraryCounts(): Promise<PublicLibraryCounts> {
  const db = createAdminClient();
  const [{ count: capabilityCount }, { count: itemCount }] = await Promise.all([
    db.from("factors").select("id", { count: "exact", head: true }).eq("is_active", true).is("deleted_at", null),
    db.from("items").select("id", { count: "exact", head: true }).eq("status", "active").is("deleted_at", null),
  ]);
  return {
    capabilityCount: capabilityCount ?? 0,
    itemCount: itemCount ?? 0,
  };
}
