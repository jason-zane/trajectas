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
import {
  classifyUsageHealth,
  needsAttention,
  type UsageHealth,
} from "@/lib/business/health-helpers";
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
  health: UsageHealth;
}

/** Per-client commercial roll-up for the Directory (keyed by clientId). */
export async function getClientCommercialSummaries(): Promise<
  Map<string, ClientCommercialSummary>
> {
  const db = createAdminClient();
  const [pricing, usage, openInvRes, healthByClient] = await Promise.all([
    listClientUsagePricing(),
    getClientUsageSummary(),
    db
      .from("invoices")
      .select("amount_due_cents, billing_accounts!inner(client_id)")
      .in("status", ["open", "uncollectible"]),
    buildClientHealth(db),
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
      health: healthByClient.get(u.clientId) ?? "none",
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

/** Classify every client's recent usage health from the monthly view (6-month window). */
async function buildClientHealth(
  db: ReturnType<typeof createAdminClient>,
): Promise<Map<string, UsageHealth>> {
  const { data, error } = await db
    .from("client_usage_monthly")
    .select("client_id, month, completed_count");
  if (error) {
    throwActionError("buildClientHealth", "Unable to load usage history.", error);
  }
  const now = new Date();
  // Anchor the window on the last *completed* month so an in-progress current
  // month can't skew recent-vs-prior (a steady client looking "declining" early
  // in the month). This evaluates the 6 completed months up to last month.
  const lastCompletedMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
  );
  const byClient = new Map<string, Map<string, number>>();
  for (const row of data ?? []) {
    const r = row as Row;
    if (!r.client_id) continue;
    const cid = String(r.client_id);
    const months = byClient.get(cid) ?? new Map<string, number>();
    months.set(toMonthKey(new Date(String(r.month))), Number(r.completed_count ?? 0));
    byClient.set(cid, months);
  }
  const out = new Map<string, UsageHealth>();
  for (const [cid, months] of byClient) {
    out.set(cid, classifyUsageHealth(monthlySeries(months, 6, lastCompletedMonth)));
  }
  return out;
}

export interface AttentionClient {
  clientId: string;
  name: string;
  slug: string;
  status: UsageHealth;
}

/** Active clients flagged declining/dormant, for the overview "needs attention" panel. */
export async function listClientsNeedingAttention(): Promise<AttentionClient[]> {
  const db = createAdminClient();
  const [clientsRes, healthByClient] = await Promise.all([
    db.from("clients").select("id, name, slug").is("deleted_at", null).eq("is_active", true),
    buildClientHealth(db),
  ]);
  if (clientsRes.error) {
    throwActionError("listClientsNeedingAttention", "Unable to load clients.", clientsRes.error);
  }
  const rank: Record<string, number> = { dormant: 0, declining: 1 };
  return (clientsRes.data ?? [])
    .map((row) => {
      const r = row as Row;
      const cid = String(r.id);
      return {
        clientId: cid,
        name: String(r.name),
        slug: String(r.slug),
        status: healthByClient.get(cid) ?? "none",
      };
    })
    .filter((c) => needsAttention(c.status))
    .sort(
      (a, b) =>
        (rank[a.status] ?? 9) - (rank[b.status] ?? 9) || a.name.localeCompare(b.name),
    );
}
