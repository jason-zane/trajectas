import { getPlatformExperienceTemplate } from "@/app/actions/experience";
import { getPlatformBrand } from "@/app/actions/brand";
import { PageHeader } from "@/components/page-header";
import { FlowEditor } from "@/components/flow-editor";

export default async function ExperienceSettingsPage() {
  const [record, brandRecord] = await Promise.all([
    getPlatformExperienceTemplate(),
    getPlatformBrand(),
  ]);

  return (
    <div className="flex flex-col h-[calc(100vh-theme(spacing.16))]">
      <PageHeader
        eyebrow="Settings"
        title="Candidate Experience"
        description="Customise the content and flow candidates see during assessments"
        className="pb-4"
      />
      <div className="flex-1 min-h-0">
        <FlowEditor
          initialRecord={record}
          brandConfig={brandRecord?.config ?? null}
        />
      </div>
    </div>
  );
}
