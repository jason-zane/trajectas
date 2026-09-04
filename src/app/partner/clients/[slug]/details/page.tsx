import { ClientDetailsForm } from "@/app/(dashboard)/clients/[slug]/details/client-details-form";
import { requirePartnerClient } from "@/lib/auth/resolve-partner-client";

export default async function PartnerClientDetailsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { client } = await requirePartnerClient(slug);

  return (
    <ClientDetailsForm
      client={client}
      // Moving a client between partners stays with the platform (D13).
      partnerOptions={[]}
      canAssignPartner={false}
      archiveRedirectPath="/partner/clients"
      ownershipLinkHref={null}
    />
  );
}
