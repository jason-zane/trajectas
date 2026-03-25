import {
  getDimensionsForSelect,
  getTraitsForSelect,
} from "@/app/actions/competencies";
import { CompetencyForm } from "../competency-form";

export default async function CreateCompetencyPage() {
  const [dimensions, traits] = await Promise.all([
    getDimensionsForSelect(),
    getTraitsForSelect(),
  ]);

  return (
    <CompetencyForm
      dimensions={dimensions}
      availableTraits={traits}
      mode="create"
    />
  );
}
