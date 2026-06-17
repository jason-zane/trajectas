import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { throwActionError } from "@/lib/security/action-errors";
import {
  ensureBillingAccountForClient,
  getBillingAccountById,
} from "@/lib/dal/billing";
import { mapBillingAccountRow, mapUsageSnapshotRow } from "@/lib/dal/billing-mappers";
import type { BillingAccount, UsageSnapshot } from "@/types/database";

export interface SetUsagePricingInput {
  clientId: string;
  enabled: boolean;
  unitPriceCents: number;
}

/** Set a client's per-unit usage rate + on/off flag (creates the account if needed). */
export async function setClientUsagePricing(
  input: SetUsagePricingInput,
): Promise<BillingAccount> {
  const account = await ensureBillingAccountForClient({ clientId: input.clientId });
  const db = createAdminClient();
  const { error } = await db
    .from("billing_accounts")
    .update({
      usage_billing_enabled: input.enabled,
      usage_unit_price_cents: Math.max(0, Math.round(input.unitPriceCents)),
    })
    .eq("id", account.id);
  if (error) {
    throwActionError(
      "setClientUsagePricing",
      "Unable to update usage pricing.",
      error,
    );
  }
  const updated = await getBillingAccountById(account.id);
  if (!updated) {
    throwActionError(
      "setClientUsagePricing",
      "Billing account vanished after update.",
      new Error("missing account"),
    );
  }
  return updated;
}

export interface ClientUsagePricing {
  clientId: string;
  billingAccountId: string;
  enabled: boolean;
  unitPriceCents: number;
}

/** Per-client usage pricing for the admin view (one row per client account). */
export async function listClientUsagePricing(): Promise<ClientUsagePricing[]> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("billing_accounts")
    .select("id, client_id, usage_billing_enabled, usage_unit_price_cents")
    .not("client_id", "is", null)
    .is("deleted_at", null);
  if (error) {
    throwActionError(
      "listClientUsagePricing",
      "Unable to load usage pricing.",
      error,
    );
  }
  return (data ?? []).map((row) => ({
    clientId: String(row.client_id),
    billingAccountId: String(row.id),
    enabled: Boolean(row.usage_billing_enabled),
    unitPriceCents: Number(row.usage_unit_price_cents ?? 0),
  }));
}

/** Accounts eligible for the monthly usage run: enabled, priced, client-owned. */
export async function listUsageBillingAccounts(): Promise<BillingAccount[]> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("billing_accounts")
    .select("*")
    .eq("usage_billing_enabled", true)
    .gt("usage_unit_price_cents", 0)
    .not("client_id", "is", null)
    .is("deleted_at", null);
  if (error) {
    throwActionError(
      "listUsageBillingAccounts",
      "Unable to load usage-billing accounts.",
      error,
    );
  }
  return (data ?? []).map(mapBillingAccountRow);
}

/**
 * Count assessments a client completed within [startIso, endIso). Mirrors the
 * `completed_count` definition (completed campaign participants, raters and
 * soft-deleted excluded) but scoped to the period via completed_at.
 */
export async function countCompletedAssessmentsInPeriod(
  clientId: string,
  startIso: string,
  endIso: string,
): Promise<number> {
  const db = createAdminClient();
  const { count, error } = await db
    .from("campaign_participants")
    .select("id, campaigns!inner(client_id, deleted_at)", {
      count: "exact",
      head: true,
    })
    .eq("campaigns.client_id", clientId)
    .is("campaigns.deleted_at", null)
    .eq("status", "completed")
    .is("campaign_rater_id", null)
    .is("deleted_at", null)
    .gte("completed_at", startIso)
    .lt("completed_at", endIso);
  if (error) {
    throwActionError(
      "countCompletedAssessmentsInPeriod",
      "Unable to count completed assessments.",
      error,
    );
  }
  return count ?? 0;
}

export async function getUsageSnapshotForPeriod(
  billingAccountId: string,
  startIso: string,
  endIso: string,
): Promise<UsageSnapshot | null> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("billing_usage_snapshots")
    .select("*")
    .eq("billing_account_id", billingAccountId)
    .eq("period_start", startIso)
    .eq("period_end", endIso)
    .maybeSingle();
  if (error) {
    throwActionError(
      "getUsageSnapshotForPeriod",
      "Unable to read usage snapshot.",
      error,
    );
  }
  return data ? mapUsageSnapshotRow(data) : null;
}

export interface RecordSnapshotInput {
  billingAccountId: string;
  periodStart: string;
  periodEnd: string;
  unit: string;
  quantity: number;
  unitPriceCents: number;
  amountCents: number;
  invoiceId?: string | null;
}

/** Freeze a period's usage. The unique (account, period) index makes this the idempotency key. */
export async function recordUsageSnapshot(
  input: RecordSnapshotInput,
): Promise<UsageSnapshot> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("billing_usage_snapshots")
    .insert({
      billing_account_id: input.billingAccountId,
      period_start: input.periodStart,
      period_end: input.periodEnd,
      unit: input.unit,
      quantity: input.quantity,
      unit_price_cents: input.unitPriceCents,
      amount_cents: input.amountCents,
      invoice_id: input.invoiceId ?? null,
    })
    .select("*")
    .single();
  if (error || !data) {
    throwActionError(
      "recordUsageSnapshot",
      "Unable to record usage snapshot.",
      error,
    );
  }
  return mapUsageSnapshotRow(data);
}

export async function linkSnapshotInvoice(
  snapshotId: string,
  invoiceId: string,
): Promise<void> {
  const db = createAdminClient();
  const { error } = await db
    .from("billing_usage_snapshots")
    .update({ invoice_id: invoiceId })
    .eq("id", snapshotId);
  if (error) {
    throwActionError(
      "linkSnapshotInvoice",
      "Unable to link snapshot to invoice.",
      error,
    );
  }
}
