import { isWorkspaceFeatureEnabled } from '@/lib/features/access'
import { WorkspaceFeatureUnavailable } from '@/components/workspace-feature-unavailable'
import { TemplateForm } from "../template-form";

export default async function CreateTemplatePage() {
  if (!await isWorkspaceFeatureEnabled('orgDiagnostics')) return <WorkspaceFeatureUnavailable feature="orgDiagnostics" />
  return <TemplateForm mode="create" />;
}
