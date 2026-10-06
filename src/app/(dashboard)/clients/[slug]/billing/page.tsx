import { notFound } from "next/navigation";

import { getClientBySlug } from "@/app/actions/clients";
import { requireAdminScope } from "@/lib/auth/authorization";
import { getClientBillingHub } from "@/lib/dal/business-centre";

import { getUsageReport } from "@/lib/dal/usage-report";
import { listClientUsageStatements } from "@/lib/dal/usage-statements";
import { resolveUsagePeriod, type UsageSearchParams } from "@/lib/usage/period";

import { ClientBillingPanel } from "./client-billing-panel";

export default async function ClientBillingPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<UsageSearchParams>;
}) {
  // Billing is Trajectas-internal: gate to platform admin before loading any
  // billing data (the hub reads invoices/billing accounts via the service-role
  // DAL, so getClientBySlug's client/partner access is not sufficient here).
  await requireAdminScope();

  const { slug } = await params;
  const client = await getClientBySlug(slug);
  if (!client) notFound();

  const period = resolveUsagePeriod(
    await searchParams,
    new Date(),
    "last-month",
  );
  const [hub, { report }, statements] = await Promise.all([
    getClientBillingHub(client.id),
    getUsageReport({ kind: "client", id: client.id }, period),
    listClientUsageStatements(client.id),
  ]);
  return (
    <ClientBillingPanel
      client={client}
      hub={hub}
      report={report}
      statements={statements}
    />
  );
}
