import { WorkspaceFeatureUnavailable } from '@/components/workspace-feature-unavailable'
import { isWorkspaceFeatureEnabled } from '@/lib/features/access'
import { notFound } from "next/navigation";
import { getDiagnosticTemplateById } from "@/app/actions/diagnostics";
import { TemplateForm } from "../../template-form";

export default async function EditTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!await isWorkspaceFeatureEnabled('orgDiagnostics')) return <WorkspaceFeatureUnavailable feature="orgDiagnostics" />

  const { id } = await params;
  const template = await getDiagnosticTemplateById(id);
  if (!template) notFound();

  return (
    <TemplateForm
      mode="edit"
      templateId={template.id}
      initialData={{
        name: template.name,
        description: template.description,
        isActive: template.isActive,
      }}
    />
  );
}
