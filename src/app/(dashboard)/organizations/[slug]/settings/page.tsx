import { getOrganizationBySlug } from "@/app/actions/organizations";
import { notFound } from "next/navigation";
import { ClientSettingsPanel } from "./client-settings-panel";

export default async function OrgSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const organization = await getOrganizationBySlug(slug);
  if (!organization) notFound();

  return (
    <ClientSettingsPanel
      organizationId={organization.id}
      canCustomizeBranding={organization.canCustomizeBranding ?? false}
    />
  );
}
