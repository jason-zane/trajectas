import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type ErrorSeverity = "warning" | "error" | "fatal";

export interface ErrorEventItem {
  id: string;
  occurredAt: string;
  severity: ErrorSeverity;
  source: string;
  message: string;
  fingerprint: string | null;
  alerted: boolean;
}

export interface ErrorGroup {
  fingerprint: string;
  source: string;
  severity: ErrorSeverity;
  count: number;
  lastSeen: string;
  sampleMessage: string;
}

export interface SystemHealth {
  database: "ok" | "error";
  email: "ok" | "error";
}

/** Most recent error events, newest first, optionally filtered by severity. */
export async function getRecentErrors(
  opts: { severity?: ErrorSeverity; limit?: number } = {},
): Promise<ErrorEventItem[]> {
  const db = createAdminClient();
  let query = db
    .from("error_events")
    .select("id, occurred_at, severity, source, message, fingerprint, alerted")
    .order("occurred_at", { ascending: false })
    .limit(opts.limit ?? 100);
  if (opts.severity) query = query.eq("severity", opts.severity);

  const { data } = await query;
  return (data ?? []).map((row) => ({
    id: row.id,
    occurredAt: row.occurred_at,
    severity: row.severity as ErrorSeverity,
    source: row.source,
    message: row.message,
    fingerprint: row.fingerprint,
    alerted: row.alerted,
  }));
}

/**
 * Group recent errors by fingerprint (most frequent first) for an at-a-glance
 * view. Grouping is done in-process over a recent window — adequate for a
 * dashboard; a SQL rollup can replace it if volume grows.
 */
interface ErrorRow {
  severity: string;
  source: string;
  message: string;
  fingerprint: string | null;
  occurred_at: string;
}

/** Collapse raw error rows into fingerprint groups, most frequent first. Pure. */
export function groupErrorRows(rows: ErrorRow[]): ErrorGroup[] {
  const groups = new Map<string, ErrorGroup>();
  for (const row of rows) {
    const key = row.fingerprint ?? `${row.source}:${row.message}`;
    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
      if (row.occurred_at > existing.lastSeen) existing.lastSeen = row.occurred_at;
    } else {
      groups.set(key, {
        fingerprint: key,
        source: row.source,
        severity: row.severity as ErrorSeverity,
        count: 1,
        lastSeen: row.occurred_at,
        sampleMessage: row.message,
      });
    }
  }
  return [...groups.values()].sort((a, b) => b.count - a.count);
}

export async function getErrorSummary(
  sinceDays = 7,
  windowLimit = 1000,
): Promise<ErrorGroup[]> {
  const db = createAdminClient();
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await db
    .from("error_events")
    .select("severity, source, message, fingerprint, occurred_at")
    .gte("occurred_at", since)
    .order("occurred_at", { ascending: false })
    .limit(windowLimit);

  return groupErrorRows((data ?? []) as ErrorRow[]);
}

/** Lightweight liveness check for the dashboard. */
export async function getSystemHealth(): Promise<SystemHealth> {
  let database: "ok" | "error" = "error";
  try {
    const db = createAdminClient();
    const { error } = await db
      .from("response_formats")
      .select("id", { head: true, count: "exact" })
      .limit(1);
    database = error ? "error" : "ok";
  } catch {
    database = "error";
  }
  return {
    database,
    email: process.env.RESEND_API_KEY ? "ok" : "error",
  };
}
