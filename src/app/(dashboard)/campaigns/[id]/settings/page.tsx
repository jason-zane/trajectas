import { getCampaignById } from "@/app/actions/campaigns";
import { getCampaignReportConfig, getReportTemplates } from "@/app/actions/reports";
import { createAdminClient } from "@/lib/supabase/admin";
import { mapOrganizationRow } from "@/lib/supabase/mappers";
import { notFound } from "next/navigation";
import { CampaignForm } from "../../campaign-form";
import { CampaignSettingsToggles } from "./campaign-settings-toggles";
import { CampaignAccessLinks } from "./campaign-access-links";
import { ReportConfigPanel } from "./report-config-panel";

export default async function CampaignSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [campaign, reportConfig, templates] = await Promise.all([
    getCampaignById(id),
    getCampaignReportConfig(id),
    getReportTemplates(),
  ]);
  if (!campaign) notFound();

  const db = createAdminClient();
  const { data } = await db
    .from("organizations")
    .select("*")
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("name");

  const organizations = (data ?? []).map(mapOrganizationRow);

  return (
    <div className="space-y-8">
      {/* Toggle switches (Zone 1 — immediate) */}
      <CampaignSettingsToggles
        campaignId={campaign.id}
        allowResume={campaign.allowResume}
        showProgress={campaign.showProgress}
        randomizeAssessmentOrder={campaign.randomizeAssessmentOrder}
      />

      {/* Access links management */}
      <CampaignAccessLinks
        campaignId={campaign.id}
        links={campaign.accessLinks}
      />

      {/* Report template assignment */}
      <ReportConfigPanel
        campaignId={campaign.id}
        config={reportConfig}
        templates={templates}
      />

      {/* Full campaign form (Zone 2 — explicit save) */}
      <CampaignForm
        mode="edit"
        campaign={campaign}
        organizations={organizations}
      />
    </div>
  );
}
