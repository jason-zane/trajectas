import { getCompetencies } from "@/app/actions/competencies";
import { CompetencyList } from "./competency-list";

export default async function CompetenciesPage() {
  const competencies = await getCompetencies();
  return <CompetencyList competencies={competencies} />;
}
