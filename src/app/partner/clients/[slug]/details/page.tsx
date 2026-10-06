import { isWorkspaceFeatureEnabled } from '@/lib/features/access'
import { WorkspaceFeatureUnavailable } from '@/components/workspace-feature-unavailable'
import { ClientDetailsForm } from "@/app/(dashboard)/clients/[slug]/details/client-details-form";
import { requirePartnerClient } from "@/lib/auth/resolve-partner-client";

export default async function PartnerClientDetailsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  if (!await isWorkspaceFeatureEnabled('clientManagement')) return <WorkspaceFeatureUnavailable feature="clientManagement" />
  const { slug } = await params;
  const { client } = await requirePartnerClient(slug);

  return (
    <ClientDetailsForm
      client={client}
      // Moving a client between partners stays with the platform (D13).
      partnerOptions={[]}
      canAssignPartner={false}
      archiveRedirectPath="/partner/clients"
      clientBasePath="/partner/clients"
      ownershipLinkHref={null}
    />
  );
}
