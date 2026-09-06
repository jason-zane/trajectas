import { listOutcomeStudies } from "@/lib/dal/outcomes";
import { OutcomeStudyList } from "@/components/outcomes/study-list";
export default async function BusinessOutcomesPage() {
  return <OutcomeStudyList {...await listOutcomeStudies()} />;
}
