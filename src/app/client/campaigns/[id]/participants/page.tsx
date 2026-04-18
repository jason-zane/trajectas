import { AlertTriangle } from "lucide-react";
import { getCampaignById } from "@/app/actions/campaigns";
import { checkQuotaAvailability } from "@/app/actions/client-entitlements";
import { notFound } from "next/navigation";
import { CampaignParticipantManager } from "@/app/(dashboard)/campaigns/[id]/participants/campaign-participant-manager";
import { CampaignAccessLinks } from "@/app/(dashboard)/campaigns/[id]/settings/campaign-access-links";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

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

  if (campaign.clientId && campaign.assessments.length > 0) {
    const assessmentIds = campaign.assessments.map((a) => a.assessmentId);
    const quotaResult = await checkQuotaAvailability(
      campaign.clientId,
      assessmentIds,
    );
    quotaWarnings = quotaResult.violations;
  }

  return (
    <div className="space-y-6">
      {/* Quota warning banner */}
      {quotaWarnings.length > 0 && (
        <Alert variant="warning">
          <AlertTriangle />
          <AlertTitle>Assessment quota limit reached</AlertTitle>
          <AlertDescription>
            <p>
              {quotaWarnings.length === 1
                ? "One assessment has reached its quota limit. New participants may not be able to complete all assessments."
                : `${quotaWarnings.length} assessments have reached their quota limits. New participants may not be able to complete all assessments.`}
            </p>
            <ul className="mt-1 space-y-0.5 text-xs">
              {quotaWarnings.map((w) => (
                <li key={w.assessmentId}>
                  {w.quotaUsed} / {w.quotaLimit} uses consumed
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
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
