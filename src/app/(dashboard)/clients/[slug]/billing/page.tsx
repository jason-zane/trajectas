import { notFound } from "next/navigation";

import { getClientBySlug } from "@/app/actions/clients";
import { getClientBillingHub } from "@/lib/dal/business-centre";

import { ClientBillingPanel } from "./client-billing-panel";

export default async function ClientBillingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const client = await getClientBySlug(slug);
  if (!client) notFound();

  const hub = await getClientBillingHub(client.id);
  return <ClientBillingPanel client={client} hub={hub} />;
}
