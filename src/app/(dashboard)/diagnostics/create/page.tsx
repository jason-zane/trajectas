import { WorkspaceFeatureUnavailable } from '@/components/workspace-feature-unavailable'
import { isWorkspaceFeatureEnabled } from '@/lib/features/access'
import {
  getClientsForDiagnosticSelect,
  getTemplatesForSelect,
} from "@/app/actions/diagnostics";
import { SessionForm } from "../session-form";

export default async function CreateDiagnosticSessionPage() {
  if (!await isWorkspaceFeatureEnabled('orgDiagnostics')) return <WorkspaceFeatureUnavailable feature="orgDiagnostics" />

  const [clients, templates] = await Promise.all([
    getClientsForDiagnosticSelect(),
    getTemplatesForSelect(),
  ]);

  return <SessionForm clients={clients} templates={templates} />;
}
