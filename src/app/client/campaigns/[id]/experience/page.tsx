import {
  getExperienceTemplate,
  getPlatformExperienceTemplate,
} from "@/app/actions/experience";
import { getEffectiveBrand } from "@/app/actions/brand";
import { getCampaignHeader } from "@/app/actions/campaigns";
import { getCampaignAssessmentIntros } from "@/app/actions/assessment-intro";
import { notFound } from "next/navigation";
import { FlowEditor } from "@/components/flow-editor";

export default async function ClientCampaignExperiencePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // getCampaignHeader runs requireCampaignAccess internally and returns null
  // on AuthorizationError, so we don't need a separate access check here.
  const [campaignTemplate, platformTemplate, campaign, campaignAssessments] =
    await Promise.all([
      getExperienceTemplate("campaign", id),
      getPlatformExperienceTemplate(),
      getCampaignHeader(id),
      getCampaignAssessmentIntros(id),
    ]);

  if (!campaign) notFound();

  // Resolve the effective brand for this campaign — client > partner > platform
  // — so the preview renders with the client's actual colours and typography,
  // not the platform defaults.
  const brandConfig = await getEffectiveBrand(campaign.clientId ?? null, id);

  return (
    <div className="flex-1 min-h-0">
      <FlowEditor
        initialRecord={campaignTemplate}
        ownerType="campaign"
        ownerId={id}
        platformTemplate={platformTemplate}
        brandConfig={brandConfig}
        campaignAssessments={campaignAssessments}
        campaignAssessmentCount={campaign.assessmentCount}
      />
    </div>
  );
}
