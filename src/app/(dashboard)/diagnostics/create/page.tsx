import {
  getClientsForDiagnosticSelect,
  getTemplatesForSelect,
} from "@/app/actions/diagnostics";
import { SessionForm } from "../session-form";

export default async function CreateDiagnosticSessionPage() {
  const [clients, templates] = await Promise.all([
    getClientsForDiagnosticSelect(),
    getTemplatesForSelect(),
  ]);

  return <SessionForm clients={clients} templates={templates} />;
}
