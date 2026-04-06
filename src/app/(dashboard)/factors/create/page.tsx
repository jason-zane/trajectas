import {
  getDimensionsForSelect,
  getConstructsForSelect,
  getClientsForFactorSelect,
} from "@/app/actions/factors";
import { FactorForm } from "../factor-form";

export default async function CreateFactorPage() {
  const [dimensions, constructs, clients] = await Promise.all([
    getDimensionsForSelect(),
    getConstructsForSelect(),
    getClientsForFactorSelect(),
  ]);

  return (
    <FactorForm
      dimensions={dimensions}
      availableConstructs={constructs}
      clients={clients}
      mode="create"
    />
  );
}
