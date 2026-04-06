import { getClientBySlug } from "@/app/actions/clients";
import { getClientInternalIntegrationSettings } from "@/app/actions/integrations";
import { notFound } from "next/navigation";
import { ClientSettingsPanel } from "./client-settings-panel";

export default async function OrgSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const client = await getClientBySlug(slug);
  if (!client) notFound();
  const integrationSettings = await getClientInternalIntegrationSettings(client.id);

  return (
    <ClientSettingsPanel
      clientId={client.id}
      clientSlug={slug}
      canCustomizeBranding={client.canCustomizeBranding ?? false}
      integrationSettings={integrationSettings}
    />
  );
}
