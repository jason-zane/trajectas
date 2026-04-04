import { AlertTriangle } from "lucide-react";
import { getCampaignById } from "@/app/actions/campaigns";
import { checkQuotaAvailability } from "@/app/actions/client-entitlements";
import { notFound } from "next/navigation";
import { CampaignParticipantManager } from "@/app/(dashboard)/campaigns/[id]/participants/campaign-participant-manager";
import { CampaignAccessLinks } from "@/app/(dashboard)/campaigns/[id]/settings/campaign-access-links";
import { Card, CardContent } from "@/components/ui/card";

export default async function ClientCampaignParticipantsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const campaign = await getCampaignById(id);
  if (!campaign) notFound();

  // Check quota status for all assessments linked to this campaign
  let quotaWarnings: {
    assessmentId: string;
    quotaLimit: number;
    quotaUsed: number;
  }[] = [];

  if (campaign.organizationId && campaign.assessments.length > 0) {
    const assessmentIds = campaign.assessments.map((a) => a.assessmentId);
    const quotaResult = await checkQuotaAvailability(
      campaign.organizationId,
      assessmentIds,
    );
    quotaWarnings = quotaResult.violations;
  }

  return (
    <div className="space-y-6">
      {/* Quota warning banner */}
      {quotaWarnings.length > 0 && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardContent className="flex items-start gap-3 py-4">
            <AlertTriangle className="size-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                Assessment quota limit reached
              </p>
              <p className="text-xs text-muted-foreground">
                {quotaWarnings.length === 1
                  ? "One assessment has reached its quota limit. New participants may not be able to complete all assessments."
                  : `${quotaWarnings.length} assessments have reached their quota limits. New participants may not be able to complete all assessments.`}
              </p>
              <ul className="text-xs text-muted-foreground mt-1 space-y-0.5">
                {quotaWarnings.map((w) => (
                  <li key={w.assessmentId}>
                    {w.quotaUsed} / {w.quotaLimit} uses consumed
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Access links */}
      <CampaignAccessLinks
        campaignId={campaign.id}
        links={campaign.accessLinks}
      />

      {/* Participant manager */}
      <CampaignParticipantManager
        campaignId={campaign.id}
        participants={campaign.participants}
      />
    </div>
  );
}
