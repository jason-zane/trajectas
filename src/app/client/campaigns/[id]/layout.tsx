import { getCampaignById } from "@/app/actions/campaigns";
import { resolveWorkspaceAccess } from "@/lib/auth/workspace-access";
import { notFound, redirect } from "next/navigation";
import { CampaignDetailShell } from "@/app/(dashboard)/campaigns/[id]/campaign-detail-shell";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function ClientCampaignDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const access = await resolveWorkspaceAccess("client");
  if (access.status !== "ok") redirect("/unauthorized");

  const { id } = await params;
  const campaign = await getCampaignById(id);
  if (!campaign) notFound();

  let canCustomizeBranding = false;
  if (campaign.organizationId) {
    const db = createAdminClient();
    const { data } = await db
      .from("organizations")
      .select("can_customize_branding")
      .eq("id", campaign.organizationId)
      .single();
    canCustomizeBranding = data?.can_customize_branding ?? false;
  }

  return (
    <CampaignDetailShell
      campaign={campaign}
      canCustomizeBranding={canCustomizeBranding}
    >
      {children}
    </CampaignDetailShell>
  );
}
