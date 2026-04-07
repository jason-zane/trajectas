import { getPlatformExperienceTemplate } from "@/app/actions/experience";
import { getPlatformBrand } from "@/app/actions/brand";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/page-header";
import { FlowEditor } from "@/components/flow-editor";

export default async function ExperienceSettingsPage() {
  const db = createAdminClient()
  const [record, brandRecord, clientsResult] = await Promise.all([
    getPlatformExperienceTemplate(),
    getPlatformBrand(),
    db.from("clients").select("id, name").eq("is_active", true).is("deleted_at", null).order("name"),
  ]);

  const clients = clientsResult.data ?? []

  return (
    <div className="flex flex-col h-[calc(100vh-theme(spacing.16))]">
      <PageHeader
        eyebrow="Settings"
        title="Participant Experience"
        description="Customise the content and flow participants see during assessments"
        className="pb-4"
      />
      <div className="flex-1 min-h-0">
        <FlowEditor
          initialRecord={record}
          brandConfig={brandRecord?.config ?? null}
          clients={clients}
        />
      </div>
    </div>
  );
}
