import {
  getOrganizationsForDiagnosticSelect,
  getTemplatesForSelect,
} from "@/app/actions/diagnostics";
import { SessionForm } from "../session-form";

export default async function CreateDiagnosticSessionPage() {
  const [organizations, templates] = await Promise.all([
    getOrganizationsForDiagnosticSelect(),
    getTemplatesForSelect(),
  ]);

  return <SessionForm organizations={organizations} templates={templates} />;
}
