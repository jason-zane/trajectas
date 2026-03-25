import { notFound } from "next/navigation";
import { getDiagnosticTemplateById } from "@/app/actions/diagnostics";
import { TemplateForm } from "../../template-form";

export default async function EditTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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
