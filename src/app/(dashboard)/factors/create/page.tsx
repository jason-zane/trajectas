import {
  getDimensionsForSelect,
  getConstructsForSelect,
  getOrganizationsForFactorSelect,
} from "@/app/actions/factors";
import { FactorForm } from "../factor-form";

export default async function CreateFactorPage() {
  const [dimensions, constructs, organizations] = await Promise.all([
    getDimensionsForSelect(),
    getConstructsForSelect(),
    getOrganizationsForFactorSelect(),
  ]);

  return (
    <FactorForm
      dimensions={dimensions}
      availableConstructs={constructs}
      organizations={organizations}
      mode="create"
    />
  );
}
