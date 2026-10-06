import type { SeriesPoint } from "@/lib/business/finance-helpers";
import type { UsagePeriod } from "./period";

export interface UsageCounts {
  added: number;
  started: number;
  completed: number;
}
export interface UsageBreakdown extends UsageCounts {
  id: string;
  name: string;
  slug: string | null;
  clientId: string | null;
  partnerId: string | null;
  partnerName: string;
  campaigns: number;
}
export interface UsageClientRef {
  id: string;
  name: string;
  slug: string;
  partnerId: string | null;
}
export interface UsagePartnerRef {
  id: string;
  name: string;
  slug: string;
}
export interface UsageCampaignRef {
  id: string;
  name: string;
  clientId: string | null;
  partnerId: string | null;
}
export type UsageEventKind = "added" | "started" | "completed";
export interface UsageEvent {
  campaignId: string;
  kind: UsageEventKind;
  at: string;
}
export type UsageGroup = "campaigns" | "clients" | "partners";
export interface UsageReport {
  period: UsagePeriod;
  generatedAt: string;
  totals: UsageCounts;
  trend: SeriesPoint[];
  trendInterval: "day" | "month";
  campaigns: UsageBreakdown[];
  clients: UsageBreakdown[];
  partners: UsageBreakdown[];
}

const emptyCounts = (): UsageCounts => ({ added: 0, started: 0, completed: 0 });
const dayKey = (date: Date) => date.toISOString().slice(0, 10);
const monthKey = (date: Date) => date.toISOString().slice(0, 7);

export function aggregateUsageReport(
  period: UsagePeriod,
  clients: UsageClientRef[],
  partners: UsagePartnerRef[],
  campaigns: UsageCampaignRef[],
  events: UsageEvent[],
  now: Date,
): UsageReport {
  const clientById = new Map(clients.map((client) => [client.id, client]));
  const partnerById = new Map(partners.map((partner) => [partner.id, partner]));
  const campaignRows = new Map<string, UsageBreakdown>();
  const clientRows = new Map<string, UsageBreakdown>();
  const partnerRows = new Map<string, UsageBreakdown>();
  const partnerName = (id: string | null) =>
    id ? (partnerById.get(id)?.name ?? "Partner") : "Direct clients";
  for (const partner of partners)
    partnerRows.set(partner.id, {
      ...emptyCounts(),
      id: partner.id,
      name: partner.name,
      slug: partner.slug,
      clientId: null,
      partnerId: partner.id,
      partnerName: partner.name,
      campaigns: 0,
    });
  for (const client of clients)
    clientRows.set(client.id, {
      ...emptyCounts(),
      id: client.id,
      name: client.name,
      slug: client.slug,
      clientId: client.id,
      partnerId: client.partnerId,
      partnerName: partnerName(client.partnerId),
      campaigns: 0,
    });
  if (clients.some((client) => !client.partnerId)) {
    partnerRows.set("direct", {
      ...emptyCounts(),
      id: "direct",
      name: "Direct clients",
      slug: null,
      clientId: null,
      partnerId: null,
      partnerName: "Direct clients",
      campaigns: 0,
    });
  }
  for (const campaign of campaigns) {
    // For client campaigns, its current client owns the partner relationship.
    const partnerId = campaign.clientId
      ? (clientById.get(campaign.clientId)?.partnerId ?? null)
      : campaign.partnerId;
    const clientKey =
      campaign.clientId ?? `partner-owned:${partnerId ?? "none"}`;
    if (!clientRows.has(clientKey))
      clientRows.set(clientKey, {
        ...emptyCounts(),
        id: clientKey,
        name: "Partner-owned campaigns",
        slug: null,
        clientId: null,
        partnerId,
        partnerName: partnerName(partnerId),
        campaigns: 0,
      });
    const partnerKey = partnerId ?? "direct";
    if (!partnerRows.has(partnerKey))
      partnerRows.set(partnerKey, {
        ...emptyCounts(),
        id: partnerKey,
        name: partnerName(partnerId),
        slug: null,
        clientId: null,
        partnerId,
        partnerName: partnerName(partnerId),
        campaigns: 0,
      });
    clientRows.get(clientKey)!.campaigns++;
    partnerRows.get(partnerKey)!.campaigns++;
    campaignRows.set(campaign.id, {
      ...emptyCounts(),
      id: campaign.id,
      name: campaign.name,
      slug: null,
      clientId: campaign.clientId,
      partnerId,
      partnerName: partnerName(partnerId),
      campaigns: 1,
    });
  }
  const totals = emptyCounts();
  const completedByDay = new Map<string, number>();
  for (const event of events) {
    const campaign = campaignRows.get(event.campaignId);
    const timestamp = new Date(event.at).getTime();
    if (!campaign || !Number.isFinite(timestamp) || timestamp > now.getTime())
      continue;
    if (period.start && timestamp < new Date(period.start).getTime()) continue;
    if (period.end && timestamp >= new Date(period.end).getTime()) continue;
    totals[event.kind]++;
    campaign[event.kind]++;
    clientRows.get(
      campaign.clientId ?? `partner-owned:${campaign.partnerId ?? "none"}`,
    )![event.kind]++;
    partnerRows.get(campaign.partnerId ?? "direct")![event.kind]++;
    if (event.kind === "completed") {
      const key = dayKey(new Date(timestamp));
      completedByDay.set(key, (completedByDay.get(key) ?? 0) + 1);
    }
  }
  const first = period.start
    ? new Date(period.start)
    : new Date([...completedByDay.keys()].sort()[0] ?? dayKey(now));
  const last = period.end
    ? new Date(Math.min(new Date(period.end).getTime() - 1, now.getTime()))
    : now;
  const daily = (last.getTime() - first.getTime()) / 86_400_000 < 62;
  const values = new Map<string, number>();
  for (const [day, count] of completedByDay) {
    const key = daily ? day : day.slice(0, 7);
    values.set(key, (values.get(key) ?? 0) + count);
  }
  const trend: SeriesPoint[] = [];
  let cursor = daily
    ? new Date(first)
    : new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), 1));
  while (cursor <= last) {
    const key = daily ? dayKey(cursor) : monthKey(cursor);
    trend.push({
      key,
      label: new Intl.DateTimeFormat(
        "en-AU",
        daily
          ? { day: "numeric", month: "short", timeZone: "UTC" }
          : { month: "short", year: "2-digit", timeZone: "UTC" },
      ).format(cursor),
      value: values.get(key) ?? 0,
    });
    cursor = daily
      ? new Date(cursor.getTime() + 86_400_000)
      : new Date(
          Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1),
        );
  }
  const sorted = (rows: Map<string, UsageBreakdown>) =>
    [...rows.values()].sort(
      (a, b) => b.completed - a.completed || a.name.localeCompare(b.name),
    );
  return {
    period,
    generatedAt: now.toISOString(),
    totals,
    trend,
    trendInterval: daily ? "day" : "month",
    campaigns: sorted(campaignRows),
    clients: sorted(clientRows),
    partners: sorted(partnerRows),
  };
}

/** Quoted CSV cells also neutralise spreadsheet formulas in user-authored names. */
function csvCell(value: string | number): string {
  let text = String(value);
  if (/^[\s]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function usageReportCsv(
  report: UsageReport,
  group: UsageGroup,
  scopeName: string,
): string {
  const header = [
    "Scope",
    "Period",
    "Start (inclusive UTC)",
    "End (exclusive UTC)",
    "Timezone",
    "Generated at",
    "Basis",
    "Unit",
    "Grouping",
    "Name",
    "Partner",
    "Campaigns (all time)",
    "Participants added",
    "Participants started",
    "Completed participant journeys",
  ];
  const rows = report[group];
  const records = rows.length
    ? rows
    : [{ ...emptyCounts(), name: "Total", partnerName: "", campaigns: 0 }];
  return [
    header,
    ...records.map((row) => [
      scopeName,
      report.period.label,
      report.period.start ?? "",
      report.period.end ?? "",
      "UTC",
      report.generatedAt,
      "Live activity; not an invoice",
      "Completed participant journey",
      group,
      row.name,
      row.partnerName,
      row.campaigns,
      row.added,
      row.started,
      row.completed,
    ]),
  ]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n");
}
