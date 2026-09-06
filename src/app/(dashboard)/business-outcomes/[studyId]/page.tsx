import { getOutcomeWorkspace } from "@/lib/dal/outcomes";
import { OutcomeWorkspace } from "@/components/outcomes/workspace";
export const maxDuration = 300;
export default async function OutcomeStudyPage({
  params,
}: {
  params: Promise<{ studyId: string }>;
}) {
  const { studyId } = await params;
  return <OutcomeWorkspace {...await getOutcomeWorkspace(studyId)} />;
}
