import { getCampaignById } from "@/app/actions/campaigns";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CampaignSettingsToggles } from "@/app/(dashboard)/campaigns/[id]/settings/campaign-settings-toggles";
import { CampaignForm } from "@/app/(dashboard)/campaigns/campaign-form";

export default async function ClientCampaignSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const campaign = await getCampaignById(id);
  if (!campaign) notFound();

  return (
    <div className="max-w-3xl space-y-8">
      {/* Campaign details — name, slug, description, dates, delete */}
      <CampaignForm
        mode="edit"
        campaign={campaign}
        defaultClientId={campaign.clientId ?? undefined}
        routePrefix="/client"
      />

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 text-sm">
            <TimelineItem label="Created" date={campaign.created_at} />
            {campaign.opensAt && (
              <TimelineItem label="Opens" date={campaign.opensAt} future />
            )}
            {campaign.closesAt && (
              <TimelineItem label="Closes" date={campaign.closesAt} future />
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
