import {
  getDimensionsForSelect,
  getConstructsForSelect,
} from "@/app/actions/factors";
import { FactorForm } from "../factor-form";

export default async function CreateFactorPage() {
  const [dimensions, constructs] = await Promise.all([
    getDimensionsForSelect(),
    getConstructsForSelect(),
  ]);

  return (
    <FactorForm
      dimensions={dimensions}
      availableConstructs={constructs}
      mode="create"
    />
  );
}
