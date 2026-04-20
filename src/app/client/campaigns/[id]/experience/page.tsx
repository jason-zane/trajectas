import {
  getExperienceTemplate,
  getPlatformExperienceTemplate,
} from "@/app/actions/experience";
import { getPlatformBrand } from "@/app/actions/brand";
import { getCampaignById } from "@/app/actions/campaigns";
import { requireCampaignAccess } from "@/lib/auth/authorization";
import { notFound } from "next/navigation";
import { FlowEditor } from "@/components/flow-editor";

export default async function ClientCampaignExperiencePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Enforce scope before fetching experience template. getExperienceTemplate
  // uses the admin client (needed for unauthenticated participant-runtime
  // callers) so it performs no auth check of its own.
  try {
    await requireCampaignAccess(id);
  } catch {
    notFound();
  }

  const [campaignTemplate, platformTemplate, brandRecord, campaign] =
    await Promise.all([
      getExperienceTemplate("campaign", id),
      getPlatformExperienceTemplate(),
      getPlatformBrand(),
      getCampaignById(id),
    ]);

  const assessmentCount = campaign?.assessments.length ?? 0;

  return (
    <div className="flex-1 min-h-0">
      <FlowEditor
        initialRecord={campaignTemplate}
        ownerType="campaign"
        ownerId={id}
        platformTemplate={platformTemplate}
        brandConfig={brandRecord?.config ?? null}
        campaignAssessmentCount={assessmentCount}
      />
    </div>
  );
}
