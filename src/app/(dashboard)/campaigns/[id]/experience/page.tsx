import {
  getExperienceTemplate,
  getPlatformExperienceTemplate,
} from "@/app/actions/experience";
import { getPlatformBrand } from "@/app/actions/brand";
import { FlowEditor } from "@/components/flow-editor";

export default async function CampaignExperiencePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [campaignTemplate, platformTemplate, brandRecord] = await Promise.all([
    getExperienceTemplate("campaign", id),
    getPlatformExperienceTemplate(),
    getPlatformBrand(),
  ]);

  return (
    <div className="flex-1 min-h-0">
      <FlowEditor
        initialRecord={campaignTemplate}
        ownerType="campaign"
        ownerId={id}
        platformTemplate={platformTemplate}
        brandConfig={brandRecord?.config ?? null}
      />
    </div>
  );
}
