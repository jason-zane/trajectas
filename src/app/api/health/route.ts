import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Liveness/readiness probe. Public, no-store, reveals no sensitive data.
 *
 * Returns 200 when the database is reachable, 503 otherwise, so Vercel /
 * external uptime monitors can detect outages before users do. `email`
 * reflects whether the Resend key is configured (informational; does not gate
 * liveness).
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, "ok" | "error"> = {};

  // Database connectivity — a head-only count against stable reference data
  // (no rows returned, no sensitive data).
  try {
    const db = createAdminClient();
    const { error } = await db
      .from("response_formats")
      .select("id", { head: true, count: "exact" })
      .limit(1);
    checks.database = error ? "error" : "ok";
  } catch {
    checks.database = "error";
  }

  // Informational: is outbound email configured? (does not gate liveness)
  checks.email = process.env.RESEND_API_KEY ? "ok" : "error";

  const healthy = checks.database === "ok";

  return NextResponse.json(
    { status: healthy ? "ok" : "degraded", checks, time: new Date().toISOString() },
    { status: healthy ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
