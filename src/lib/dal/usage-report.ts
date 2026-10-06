import "server-only";

import {
  applyTenantClientFilter,
  AuthorizationError,
  isUnconfinedPlatformAdmin,
  requireAdminScope,
  requireClientAccess,
  requirePartnerAccess,
  type AuthorizedScope,
} from "@/lib/auth/authorization";
import { createAdminClient } from "@/lib/supabase/admin";
import { throwActionError } from "@/lib/security/action-errors";
import type { UsagePeriod } from "@/lib/usage/period";
import {
  aggregateUsageReport,
  type UsageCampaignRef,
  type UsageClientRef,
  type UsageEvent,
  type UsageEventKind,
  type UsagePartnerRef,
  type UsageReport,
} from "@/lib/usage/report";

export type UsageTarget =
  | { kind: "client"; id: string }
  | { kind: "partner"; id: string }
  | { kind: "business"; clientId?: string; partnerId?: string };
type Row = Record<string, unknown>;
const PAGE = 500;

/** Smaller than PostgREST's row cap; continue until an empty page, even if the server caps lower. */
export async function readUsagePages(
  fetchPage: (
    offset: number,
    end: number,
  ) => PromiseLike<{ data: Row[] | null; error: unknown }>,
): Promise<Row[]> {
  const rows: Row[] = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await fetchPage(offset, offset + PAGE - 1);
    if (error)
      throwActionError("usageReport", "Unable to load usage activity.", error);
    if (!data?.length) return rows;
    rows.push(...data);
    offset += data.length;
  }
}

async function authorizeUsageTarget(
  target: UsageTarget,
): Promise<AuthorizedScope> {
  if (target.kind === "client")
    return (await requireClientAccess(target.id, { includeArchived: true }))
      .scope;
  if (target.kind === "partner") {
    const { scope } = await requirePartnerAccess(target.id, {
      includeArchived: true,
    });
    if (
      !isUnconfinedPlatformAdmin(scope) &&
      !scope.partnerIds.includes(target.id)
    )
      throw new AuthorizationError();
    return scope;
  }
  return requireAdminScope();
}

/** Only aggregate counts leave this DAL; participant identities are never returned. */
export async function getUsageReport(
  target: UsageTarget,
  period: UsagePeriod,
): Promise<{
  report: UsageReport;
  clientOptions: UsageClientRef[];
  partnerOptions: UsagePartnerRef[];
}> {
  const scope = await authorizeUsageTarget(target);
  const db = createAdminClient();
  const now = new Date();
  const clientQuery = () => {
    let query = db
      .from("clients")
      .select("id, name, slug, partner_id")
      .is("deleted_at", null)
      .order("id");
    if (target.kind === "client") query = query.eq("id", target.id);
    if (target.kind === "partner") query = query.eq("partner_id", target.id);
    return applyTenantClientFilter(query, scope, "id");
  };
  const baseClients = clientQuery();
  const clientRows = baseClients
    ? await readUsagePages((offset, end) => clientQuery()!.range(offset, end))
    : [];
  const clientOptions: UsageClientRef[] = clientRows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    partnerId: row.partner_id ? String(row.partner_id) : null,
  }));
  const partnerIds = [
    ...new Set(
      clientOptions.flatMap((client) =>
        client.partnerId ? [client.partnerId] : [],
      ),
    ),
  ];
  if (target.kind === "partner" && !partnerIds.includes(target.id))
    partnerIds.push(target.id);
  const partnerQuery = () => {
    let query = db
      .from("partners")
      .select("id, name, slug")
      .is("deleted_at", null)
      .order("id");
    if (target.kind === "partner") return query.eq("id", target.id);
    if (target.kind !== "business" || !isUnconfinedPlatformAdmin(scope))
      query = query.in("id", partnerIds);
    return query;
  };
  const includeAllPartners =
    target.kind === "business" && isUnconfinedPlatformAdmin(scope);
  const partnerRows =
    includeAllPartners || partnerIds.length
      ? await readUsagePages((offset, end) => partnerQuery().range(offset, end))
      : [];
  const partnerOptions: UsagePartnerRef[] = partnerRows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
  }));
  let clients = clientOptions;
  let partners = partnerOptions;
  if (target.kind === "business") {
    if (target.clientId)
      clients = clients.filter((client) => client.id === target.clientId);
    if (target.partnerId)
      clients = clients.filter(
        (client) => client.partnerId === target.partnerId,
      );
    if (target.partnerId)
      partners = partners.filter((partner) => partner.id === target.partnerId);
    if (target.clientId)
      partners = partners.filter((partner) =>
        clients.some((client) => client.partnerId === partner.id),
      );
  }
  const campaignRows: Row[] = [];
  // Chunk id filters to keep URLs bounded; paginate every query before aggregating.
  for (let i = 0; i < clients.length; i += 100) {
    const ids = clients.slice(i, i + 100).map((client) => client.id);
    campaignRows.push(
      ...(await readUsagePages((offset, end) =>
        db
          .from("campaigns")
          .select("id, title, client_id, partner_id")
          .in("client_id", ids)
          .is("deleted_at", null)
          .order("id")
          .range(offset, end),
      )),
    );
  }
  // Clientless partner activity is accessible only from the partner workspace or an unconfined admin.
  const allowPartnerOwned =
    isUnconfinedPlatformAdmin(scope) ||
    (target.kind === "partner" &&
      scope.activeContext?.tenantType !== "client" &&
      scope.previewContext?.tenantType !== "client" &&
      scope.supportSession?.targetSurface !== "client");
  if (
    allowPartnerOwned &&
    target.kind !== "client" &&
    !(target.kind === "business" && target.clientId)
  ) {
    for (const partner of partners) {
      campaignRows.push(
        ...(await readUsagePages((offset, end) =>
          db
            .from("campaigns")
            .select("id, title, client_id, partner_id")
            .eq("partner_id", partner.id)
            .is("client_id", null)
            .is("deleted_at", null)
            .order("id")
            .range(offset, end),
        )),
      );
    }
  }
  const campaigns: UsageCampaignRef[] = campaignRows.map((row) => ({
    id: String(row.id),
    name: String(row.title),
    clientId: row.client_id ? String(row.client_id) : null,
    partnerId: row.partner_id ? String(row.partner_id) : null,
  }));
  const events: UsageEvent[] = [];
  const fields = {
    added: "created_at",
    started: "started_at",
    completed: "completed_at",
  } as const;
  for (let i = 0; i < campaigns.length; i += 100) {
    const ids = campaigns.slice(i, i + 100).map((campaign) => campaign.id);
    const batches = await Promise.all(
      (Object.entries(fields) as [UsageEventKind, string][]).map(
        async ([kind, field]) => {
          const rows = await readUsagePages((offset, end) => {
            let query = db
              .from("campaign_participants")
              .select("id, campaign_id, created_at, started_at, completed_at")
              .in("campaign_id", ids)
              .is("deleted_at", null)
              .is("campaign_rater_id", null)
              .not(field, "is", null)
              .lte(field, now.toISOString())
              .order("id");
            if (kind === "completed") query = query.eq("status", "completed");
            if (period.start) query = query.gte(field, period.start);
            if (period.end) query = query.lt(field, period.end);
            return query.range(offset, end);
          });
          return rows.map((row) => ({
            campaignId: String(row.campaign_id),
            kind,
            at: String(row[field]),
          }));
        },
      ),
    );
    events.push(...batches.flat());
  }
  return {
    report: aggregateUsageReport(
      period,
      clients,
      partners,
      campaigns,
      events,
      now,
    ),
    clientOptions,
    partnerOptions,
  };
}
