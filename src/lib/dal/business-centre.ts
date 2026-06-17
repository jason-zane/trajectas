import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { throwActionError } from "@/lib/security/action-errors";
import { mapInvoiceRow } from "@/lib/dal/billing-mappers";
import { getBillingAccountByClientId } from "@/lib/dal/billing";
import { listClientUsagePricing } from "@/lib/dal/usage-billing";
import { getClientUsageSummary } from "@/lib/dal/usage";
import {
  monthlySeries,
  summarizeInvoices,
  toMonthKey,
  type InvoiceSummary,
  type SeriesPoint,
} from "@/lib/business/finance-helpers";
import type { BillingAccount, Invoice } from "@/types/database";

type Row = Record<string, unknown>;
type ClientRef = { client_id?: string | null } | null;

/** All invoices for one client (joined through its billing account). */
export async function listInvoicesForClient(clientId: string): Promise<Invoice[]> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("invoices")
    .select("*, billing_accounts!inner(client_id)")
    .eq("billing_accounts.client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) {
    throwActionError("listInvoicesForClient", "Unable to load invoices.", error);
  }
  return (data ?? []).map((row) => mapInvoiceRow(row as Row));
}

/** Last 12 months of completed-assessment counts for a client (gaps filled). */
export async function getClientUsageMonthly(clientId: string): Promise<SeriesPoint[]> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("client_usage_monthly")
    .select("month, completed_count")
    .eq("client_id", clientId);
  if (error) {
    throwActionError("getClientUsageMonthly", "Unable to load usage history.", error);
  }
  const byKey = new Map<string, number>();
  for (const row of data ?? []) {
    const r = row as Row;
    byKey.set(toMonthKey(new Date(String(r.month))), Number(r.completed_count ?? 0));
  }
  return monthlySeries(byKey, 12, new Date());
}

export interface ClientBillingHub {
  billingAccount: BillingAccount | null;
  usageTotals: { invited: number; completed: number };
  usageMonthly: SeriesPoint[];
  invoices: Invoice[];
}

/** Everything the client Billing tab needs, in one call. */
export async function getClientBillingHub(clientId: string): Promise<ClientBillingHub> {
  const db = createAdminClient();
  const [billingAccount, invoices, usageMonthly, totalsRes] = await Promise.all([
    getBillingAccountByClientId(clientId),
    listInvoicesForClient(clientId),
    getClientUsageMonthly(clientId),
    db
      .from("campaigns_with_counts")
      .select("participant_count, completed_count")
      .eq("client_id", clientId)
      .is("deleted_at", null),
  ]);
  if (totalsRes.error) {
    throwActionError("getClientBillingHub", "Unable to load usage totals.", totalsRes.error);
  }
  let invited = 0;
  let completed = 0;
  for (const row of totalsRes.data ?? []) {
    const r = row as Row;
    invited += Number(r.participant_count ?? 0);
    completed += Number(r.completed_count ?? 0);
  }
  return { billingAccount, usageTotals: { invited, completed }, usageMonthly, invoices };
}

export interface ClientCommercialSummary {
  clientId: string;
  completed: number;
  outstandingCents: number;
  usageBillingEnabled: boolean;
  usageUnitPriceCents: number;
}

/** Per-client commercial roll-up for the Directory (keyed by clientId). */
export async function getClientCommercialSummaries(): Promise<
  Map<string, ClientCommercialSummary>
> {
  const db = createAdminClient();
  const [pricing, usage, openInvRes] = await Promise.all([
    listClientUsagePricing(),
    getClientUsageSummary(),
    db
      .from("invoices")
      .select("amount_due_cents, billing_accounts!inner(client_id)")
      .in("status", ["open", "uncollectible"]),
  ]);
  if (openInvRes.error) {
    throwActionError("getClientCommercialSummaries", "Unable to load invoices.", openInvRes.error);
  }

  const outstandingByClient = new Map<string, number>();
  for (const row of openInvRes.data ?? []) {
    const r = row as Row & { billing_accounts?: ClientRef };
    const cid = r.billing_accounts?.client_id;
    if (!cid) continue;
    outstandingByClient.set(cid, (outstandingByClient.get(cid) ?? 0) + Number(r.amount_due_cents ?? 0));
  }

  const pricingByClient = new Map(pricing.map((p) => [p.clientId, p]));
  const out = new Map<string, ClientCommercialSummary>();
  for (const u of usage) {
    const p = pricingByClient.get(u.clientId);
    out.set(u.clientId, {
      clientId: u.clientId,
      completed: u.assessmentsCompleted,
      outstandingCents: outstandingByClient.get(u.clientId) ?? 0,
      usageBillingEnabled: p?.enabled ?? false,
      usageUnitPriceCents: p?.unitPriceCents ?? 0,
    });
  }
  return out;
}

export interface FinanceOverview extends InvoiceSummary {
  usageThisMonthCompleted: number;
  usageThisMonthRevenueCents: number;
  activeUsageClients: number;
}

/** Cross-client metrics for the Business Centre overview landing. */
export async function getFinanceOverview(): Promise<FinanceOverview> {
  const now = new Date();
  const db = createAdminClient();
  const [invRes, pricing, usageRes] = await Promise.all([
    db.from("invoices").select("*").order("created_at", { ascending: false }),
    listClientUsagePricing(),
    db.from("client_usage_monthly").select("client_id, month, completed_count"),
  ]);
  if (invRes.error) {
    throwActionError("getFinanceOverview", "Unable to load invoices.", invRes.error);
  }
  if (usageRes.error) {
    throwActionError("getFinanceOverview", "Unable to load usage.", usageRes.error);
  }

  const invoices = (invRes.data ?? []).map((row) => mapInvoiceRow(row as Row));
  const summary = summarizeInvoices(invoices, now);

  const thisKey = toMonthKey(now);
  const pricingByClient = new Map(pricing.map((p) => [p.clientId, p]));
  let usageThisMonthCompleted = 0;
  let usageThisMonthRevenueCents = 0;
  for (const row of usageRes.data ?? []) {
    const r = row as Row;
    if (!r.month || toMonthKey(new Date(String(r.month))) !== thisKey) continue;
    const count = Number(r.completed_count ?? 0);
    usageThisMonthCompleted += count;
    const p = r.client_id ? pricingByClient.get(String(r.client_id)) : undefined;
    if (p?.enabled) usageThisMonthRevenueCents += count * p.unitPriceCents;
  }

  return {
    ...summary,
    usageThisMonthCompleted,
    usageThisMonthRevenueCents,
    activeUsageClients: pricing.filter((p) => p.enabled && p.unitPriceCents > 0).length,
  };
}
