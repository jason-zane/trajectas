import { notFound } from "next/navigation";
import { getPartnerBySlug } from "@/app/actions/partners";
import { PartnerSettingsPanel } from "./partner-settings-panel";

export default async function PartnerSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const partner = await getPartnerBySlug(slug);
  if (!partner) notFound();

  return (
    <PartnerSettingsPanel
      partnerId={partner.id}
      partnerSlug={slug}
      canCustomizeBranding={partner.canCustomizeBranding ?? false}
    />
  );
}
