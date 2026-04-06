import { getClientBySlug } from "@/app/actions/clients";
import { getClientInternalIntegrationSettings } from "@/app/actions/integrations";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ClientSettingsPanel } from "./client-settings-panel";

export default async function OrgSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const client = await getClientBySlug(slug);
  if (!client) notFound();

  let partnerBrandingDisabled = false;
  if (client.partnerId) {
    const db = await createClient();
    const { data: partner } = await db
      .from("partners")
      .select("can_customize_branding")
      .eq("id", client.partnerId)
      .single();
    partnerBrandingDisabled = partner != null && !partner.can_customize_branding;
  }

  const integrationSettings = await getClientInternalIntegrationSettings(client.id);

  return (
    <ClientSettingsPanel
      clientId={client.id}
      clientSlug={slug}
      canCustomizeBranding={client.canCustomizeBranding ?? false}
      partnerBrandingDisabled={partnerBrandingDisabled}
      integrationSettings={integrationSettings}
    />
  );
}
