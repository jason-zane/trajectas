import { notFound, redirect } from "next/navigation";
import { getPartnerBySlug, getPartnerStats, getRecentPartnerCampaigns } from "@/app/actions/partners";
import { canManagePartnerDirectory, resolveAuthorizedScope } from "@/lib/auth/authorization";
import { PartnerOverview } from "./partner-overview";

export default async function PartnerOverviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [partner, scope] = await Promise.all([
    getPartnerBySlug(slug, { includeArchived: true }),
    resolveAuthorizedScope(),
  ]);
  if (!partner) notFound();
  if (!canManagePartnerDirectory(scope)) {
    redirect("/unauthorized?reason=partner-directory");
  }

  const [stats, recentCampaigns] = await Promise.all([
    getPartnerStats(partner.id),
    getRecentPartnerCampaigns(partner.id),
  ]);

  return (
    <PartnerOverview
      partner={partner}
      stats={stats}
      recentCampaigns={recentCampaigns}
    />
  );
}
