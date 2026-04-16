import { getCampaignById, getActiveAssessments } from "@/app/actions/campaigns";
import {
  getFactorsForAssessment,
  getFactorSelectionForCampaignAssessment,
} from "@/app/actions/factor-selection";
import {
  getConstructsForAssessment,
  getConstructSelectionForCampaignAssessment,
} from "@/app/actions/construct-selection";
import { getItemSelectionRulesForEstimate } from "@/app/actions/item-selection-rules";
import { notFound } from "next/navigation";
import { CampaignAssessmentsList } from "./campaign-assessments-list";
import type {
  FactorPickerData,
  ConstructPickerData,
} from "./campaign-assessments-list";

export default async function CampaignAssessmentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const campaign = await getCampaignById(id);
  if (!campaign) notFound();

  const allAssessments = await getActiveAssessments();

  const factorCustomisable = campaign.assessments.filter(
    (a) => a.scoringLevel === "factor" && a.minCustomFactors != null,
  );
  const constructCustomisable = campaign.assessments.filter(
    (a) => a.scoringLevel === "construct" && a.minCustomConstructs != null,
  );

  const needsRules =
    factorCustomisable.length > 0 || constructCustomisable.length > 0;

  const [itemSelectionRules, factorResults, constructResults] =
    await Promise.all([
      needsRules ? getItemSelectionRulesForEstimate() : Promise.resolve([]),
      Promise.all(
        factorCustomisable.map(async (ca) => {
          const [factorsByDimension, currentSelection] = await Promise.all([
            getFactorsForAssessment(ca.assessmentId),
            getFactorSelectionForCampaignAssessment(ca.id),
          ]);
          return {
            campaignAssessmentId: ca.id,
            factorsByDimension,
            currentSelection,
            minCustomFactors: ca.minCustomFactors!,
          } satisfies FactorPickerData;
        }),
      ),
      Promise.all(
        constructCustomisable.map(async (ca) => {
          const [constructsByDimension, currentSelection] = await Promise.all([
            getConstructsForAssessment(ca.assessmentId),
            getConstructSelectionForCampaignAssessment(ca.id),
          ]);
          return {
            campaignAssessmentId: ca.id,
            constructsByDimension,
            currentSelection,
            minCustomConstructs: ca.minCustomConstructs!,
          } satisfies ConstructPickerData;
        }),
      ),
    ]);

  const factorPickerDataMap: Record<string, FactorPickerData> = {};
  for (const result of factorResults) {
    factorPickerDataMap[result.campaignAssessmentId] = result;
  }

  const constructPickerDataMap: Record<string, ConstructPickerData> = {};
  for (const result of constructResults) {
    constructPickerDataMap[result.campaignAssessmentId] = result;
  }

  const hasCompletedParticipants = campaign.participants.some(
    (p) => p.status === "completed",
  );

  return (
    <CampaignAssessmentsList
      campaignId={campaign.id}
      linkedAssessments={campaign.assessments}
      allAssessments={allAssessments}
      factorPickerDataMap={factorPickerDataMap}
      constructPickerDataMap={constructPickerDataMap}
      itemSelectionRules={itemSelectionRules}
      hasCompletedParticipants={hasCompletedParticipants}
    />
  );
}
