import "server-only";
import { createHmac } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { logActionError } from "@/lib/security/action-errors";
import { outcomeResultSchema } from "@/lib/outcomes/result-schema";
import { outcomeInputHash } from "@/lib/outcomes/snapshot";
import type { OutcomeInput } from "@/lib/outcomes/types";
function workerUrl() {
  const configured = process.env.OUTCOMES_WORKER_URL;
  if (configured) {
    const url = new URL(configured);
    if (process.env.NODE_ENV === "production" && url.protocol !== "https:")
      throw new Error("The production worker must use HTTPS.");
    return url.toString();
  }
  if (process.env.VERCEL_ENV === "production")
    return new URL(
      "/api/outcomes-worker",
      process.env.ADMIN_APP_URL ?? "https://admin.trajectas.com",
    ).toString();
  if (process.env.VERCEL_URL)
    return `https://${process.env.VERCEL_URL}/api/outcomes-worker`;
  return "http://127.0.0.1:8874";
}
export async function runNextOutcomeJob(runId?: string) {
  const db = createAdminClient(),
    secret = process.env.CRON_SECRET;
  if (!secret) throw new Error("Statistical worker signing is not configured.");
  const claim = await db.rpc("claim_outcome_run", { p_run_id: runId ?? null });
  if (claim.error) {
    logActionError("outcomes.claim", claim.error);
    throw new Error("Unable to claim an analysis job.");
  }
  const job = claim.data?.[0] as
    | {
        id: string;
        input: OutcomeInput;
        input_hash: string;
        lease_id: string;
        attempts: number;
      }
    | undefined;
  if (!job) return false;
  try {
    if (outcomeInputHash(job.input) !== job.input_hash)
      throw new Error("The frozen analysis input failed its integrity check.");
    const body = JSON.stringify(job.input),
      timestamp = String(Math.floor(Date.now() / 1000));
    const signature = createHmac("sha256", secret)
      .update(`outcomes-v1:${timestamp}:${body}`)
      .digest("hex");
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
      "X-Outcomes-Timestamp": timestamp,
      "X-Outcomes-Signature": signature,
    };
    if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET)
      headers["x-vercel-protection-bypass"] =
        process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
    const response = await fetch(workerUrl(), {
      method: "POST",
      body,
      headers,
      signal: AbortSignal.timeout(220000),
      redirect: "error",
      cache: "no-store",
    });
    if (!response.ok)
      throw new Error(
        `The statistical worker returned HTTP ${response.status}. Retry after checking worker availability.`,
      );
    const result = outcomeResultSchema.parse(await response.json());
    if (
      result.results.length !== job.input.config.metrics.length ||
      result.results.some(
        (r) =>
          !job.input.config.metrics.some((m) => m.id === r.metricId) ||
          r.findings.length !== job.input.predictors.length ||
          r.findings.some(
            (f) => !job.input.predictors.some((p) => p.id === f.predictorId),
          ),
      )
    )
      throw new Error(
        "The statistical output did not match the frozen study inputs.",
      );
    const saved = await db
      .from("outcome_runs")
      .update({
        status: "completed",
        result,
        completed_at: new Date().toISOString(),
        lease_id: null,
        claimed_at: null,
      })
      .eq("id", job.id)
      .eq("lease_id", job.lease_id)
      .eq("status", "running");
    if (saved.error) throw new Error("Unable to save the analysis result.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Analysis failed.";
    logActionError("outcomes.worker", new Error(message));
    const saved = await db
      .from("outcome_runs")
      .update({
        status: job.attempts >= 3 ? "failed" : "queued",
        error: message.slice(0, 400),
        lease_id: null,
        claimed_at: null,
      })
      .eq("id", job.id)
      .eq("lease_id", job.lease_id)
      .eq("status", "running");
    if (saved.error) logActionError("outcomes.worker_status", saved.error);
  }
  return true;
}
