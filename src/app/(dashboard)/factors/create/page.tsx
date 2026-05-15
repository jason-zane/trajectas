import {
  getDimensionsForSelect,
  getConstructsForSelect,
  getClientsForFactorSelect,
} from "@/app/actions/factors";
import { getContentSources } from "@/app/actions/content-sources";
import { FactorForm } from "../factor-form";

export default async function CreateFactorPage() {
  const [dimensions, constructs, clients, contentSources] = await Promise.all([
    getDimensionsForSelect(),
    getConstructsForSelect(),
    getClientsForFactorSelect(),
    getContentSources(),
  ]);

  return (
    <FactorForm
      dimensions={dimensions}
      availableConstructs={constructs}
      clients={clients}
      contentSources={contentSources}
      mode="create"
    />
  );
}
