/**
 * Monthly usage-billing cron.
 *
 * On the 1st of each month it bills the just-closed month for every
 * usage-enabled billing account: counts completed assessments in the period,
 * freezes an immutable snapshot, and issues a Stripe usage invoice. All logic
 * lives in src/lib/billing/usage-run.ts; this route is the secured entry point.
 *
 * Secured by the standard Vercel cron pattern: an Authorization: Bearer
 * ${CRON_SECRET} header. Scheduling is defined in vercel.json (`crons`).
 */

import { NextResponse } from "next/server";

import { runUsageBilling } from "@/lib/billing/usage-run";
import { reportError } from "@/lib/observability/report-error";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request): Promise<Response> {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[cron:usage-billing] CRON_SECRET not configured");
    return new Response("CRON_SECRET not configured", { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const result = await runUsageBilling(new Date());
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cron:usage-billing] run failed:", message);
    await reportError(err, {
      source: "cron.usage-billing",
      severity: "error",
      alert: true,
      context: { phase: "run" },
    });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
