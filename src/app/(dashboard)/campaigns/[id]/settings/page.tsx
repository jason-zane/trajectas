import { getCampaignById } from "@/app/actions/campaigns";
import { getCampaignReportConfig, getReportTemplates } from "@/app/actions/reports";
import { createAdminClient } from "@/lib/supabase/admin";
import { mapOrganizationRow } from "@/lib/supabase/mappers";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CampaignForm } from "../../campaign-form";
import { CampaignSettingsToggles } from "./campaign-settings-toggles";
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
      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 text-sm">
            <TimelineItem
              label="Created"
              date={campaign.created_at}
            />
            {campaign.opensAt && (
              <TimelineItem
                label="Opens"
                date={campaign.opensAt}
                future
              />
            )}
            {campaign.closesAt && (
              <TimelineItem
                label="Closes"
                date={campaign.closesAt}
                future
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Toggle switches (Zone 1 — immediate) */}
      <CampaignSettingsToggles
        campaignId={campaign.id}
        allowResume={campaign.allowResume}
        showProgress={campaign.showProgress}
        randomizeAssessmentOrder={campaign.randomizeAssessmentOrder}
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

function TimelineItem({
  label,
  date,
  future,
}: {
  label: string;
  date: string;
  future?: boolean;
}) {
  const d = new Date(date);
  const formatted = d.toLocaleDateString("en-AU", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="flex items-center gap-3">
      <div
        className={`size-2 rounded-full ${future ? "bg-muted-foreground/40" : "bg-primary"}`}
      />
      <span className="text-muted-foreground w-20">{label}</span>
      <span className={future ? "text-muted-foreground" : ""}>{formatted}</span>
    </div>
  );
}
