import { notFound } from "next/navigation";

import { getClientBySlug } from "@/app/actions/clients";
import { requireAdminScope } from "@/lib/auth/authorization";
import { getClientBillingHub } from "@/lib/dal/business-centre";

import { ClientBillingPanel } from "./client-billing-panel";

export default async function ClientBillingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  // Billing is Trajectas-internal: gate to platform admin before loading any
  // billing data (the hub reads invoices/billing accounts via the service-role
  // DAL, so getClientBySlug's client/partner access is not sufficient here).
  await requireAdminScope();

  const { slug } = await params;
  const client = await getClientBySlug(slug);
  if (!client) notFound();

  const hub = await getClientBillingHub(client.id);
  return <ClientBillingPanel client={client} hub={hub} />;
}
