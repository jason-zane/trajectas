import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Display name for a partner, or null when the partner doesn't exist.
 * Read-only lookup used for inheritance labels (e.g. "branding inherited
 * from <partner>"); callers are responsible for having already authorised
 * access to the surrounding resource.
 */
export async function getPartnerName(partnerId: string): Promise<string | null> {
  const db = createAdminClient();
  const { data } = await db
    .from("partners")
    .select("name")
    .eq("id", partnerId)
    .single();
  return data?.name ?? null;
}
