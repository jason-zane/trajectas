import { getBrandConfig } from "@/app/actions/brand";
import { getPartnerBrandingEnabled } from "@/app/actions/partner-entitlements";
import { ClientBrandEditor } from "@/app/(dashboard)/clients/[slug]/branding/client-brand-editor";
import { EmptyState } from "@/components/empty-state";
import { resolveInheritedBrand } from "@/lib/brand/resolve-inherited-brand";
import { requirePartnerClient } from "@/lib/auth/resolve-partner-client";

export default async function PartnerClientBrandingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { client, partnerId } = await requirePartnerClient(slug);

  // D5: the partner's own flag governs whether it may brand anything at all.
  const brandingEnabled = await getPartnerBrandingEnabled(partnerId);
  if (!brandingEnabled) {
    return (
      <EmptyState
        eyebrow="Branding"
        title="Brand customisation is not enabled"
        description="Trajectas has not enabled brand customisation for your partner organisation yet. Contact Trajectas to switch it on."
      />
    );
  }

  const [clientRecord, inheritedBrand] = await Promise.all([
    getBrandConfig("client", client.id),
    resolveInheritedBrand("client", client.id),
  ]);

  return (
    <ClientBrandEditor
      clientId={client.id}
      clientName={client.name}
      initialRecord={clientRecord}
      inheritedBrand={inheritedBrand}
    />
  );
}
