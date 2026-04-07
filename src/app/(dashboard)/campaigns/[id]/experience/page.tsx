import {
  getExperienceTemplate,
  getPlatformExperienceTemplate,
} from "@/app/actions/experience";
import { getEffectiveBrand } from "@/app/actions/brand";
import { getCampaignById } from "@/app/actions/campaigns";
import { getCampaignAssessmentIntros } from "@/app/actions/assessment-intro";
import { FlowEditor } from "@/components/flow-editor";

export default async function CampaignExperiencePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [campaignTemplate, platformTemplate, campaign, campaignAssessments] =
    await Promise.all([
      getExperienceTemplate("campaign", id),
      getPlatformExperienceTemplate(),
      getCampaignById(id),
      getCampaignAssessmentIntros(id),
    ]);

  const brandConfig = await getEffectiveBrand(
    campaign?.clientId ?? null,
    id
  );

  return (
    <div className="flex-1 min-h-0">
      <FlowEditor
        initialRecord={campaignTemplate}
        ownerType="campaign"
        ownerId={id}
        platformTemplate={platformTemplate}
        brandConfig={brandConfig}
        campaignAssessments={campaignAssessments}
      />
    </div>
  );
}
