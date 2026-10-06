import { isWorkspaceFeatureEnabled } from '@/lib/features/access'
import { WorkspaceFeatureUnavailable } from '@/components/workspace-feature-unavailable'
import { ClientDetailShell } from "@/app/(dashboard)/clients/[slug]/client-detail-shell";
import { requirePartnerClient } from "@/lib/auth/resolve-partner-client";

export default async function PartnerClientDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  if (!await isWorkspaceFeatureEnabled('clientDirectory')) return <WorkspaceFeatureUnavailable feature="clientDirectory" />
  const { slug } = await params;
  const { client } = await requirePartnerClient(slug);

  return (
    <ClientDetailShell
      client={client}
      // Billing is platform-only; the shell hides that tab for non-admins.
      isPlatformAdmin={false}
      basePath={`/partner/clients/${client.slug}`}
    >
      {children}
    </ClientDetailShell>
  );
}
