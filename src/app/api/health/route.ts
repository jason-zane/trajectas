import { NextResponse } from "next/server";

import { getReadinessChecks } from "@/lib/observability/readiness";

/**
 * Liveness/readiness probe. Public, no-store, reveals no sensitive data.
 *
 * Checks database and distributed rate limiting, stalled report queues, and
 * essential email/cron configuration. Exposes only coarse status, never rows.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const checks = await getReadinessChecks();
  const healthy = Object.values(checks).every(check => check === "ok");

  return NextResponse.json(
    { status: healthy ? "ok" : "degraded", checks, time: new Date().toISOString() },
    { status: healthy ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
