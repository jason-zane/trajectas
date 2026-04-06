import { getClientBySlug } from "@/app/actions/clients";
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

  return (
    <ClientSettingsPanel
      clientId={client.id}
      canCustomizeBranding={client.canCustomizeBranding ?? false}
    />
  );
}
