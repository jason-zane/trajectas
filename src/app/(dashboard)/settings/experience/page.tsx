import { connection } from "next/server"
import { getPlatformExperienceTemplate } from "@/app/actions/experience";
import { getCachedPlatformBrand } from "@/app/actions/brand";
import { createAdminClient } from "@/lib/supabase/admin";
import { mergeBrandLayers } from "@/lib/brand/merge";
import { PageHeader } from "@/components/page-header";
import { FlowEditor } from "@/components/flow-editor";

export default async function ExperienceSettingsPage() {
  await connection()
  const db = createAdminClient()
  const [record, brandRecord, clientsResult] = await Promise.all([
    getPlatformExperienceTemplate(),
    getCachedPlatformBrand(),
    db.from("clients").select("id, name").eq("is_active", true).is("deleted_at", null).order("name"),
  ]);

  const clients = clientsResult.data ?? []
  const brandConfig = brandRecord?.config ? mergeBrandLayers([brandRecord.config]) : null

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
          brandConfig={brandConfig}
          clients={clients}
        />
      </div>
    </div>
  );
}
