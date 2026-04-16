import { getCampaignById } from "@/app/actions/campaigns";
import { getClientAssessmentLibrary } from "@/app/actions/client-entitlements";
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
import { CampaignAssessmentsList } from "@/app/(dashboard)/campaigns/[id]/assessments/campaign-assessments-list";
import type {
  FactorPickerData,
  ConstructPickerData,
} from "@/app/(dashboard)/campaigns/[id]/assessments/campaign-assessments-list";

export default async function ClientCampaignAssessmentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const campaign = await getCampaignById(id);
  if (!campaign) notFound();

  // Fetch only the assessments assigned to this client
  let availableAssessments: Array<{
    id: string;
    title: string;
    status: string;
    description?: string;
    factorCount?: number;
    sectionCount?: number;
    totalItemCount?: number;
    estimatedDurationMinutes?: number;
    formatLabel?: string;
    quotaLimit?: number | null;
    quotaUsed?: number;
    quotaRemaining?: number | null;
  }> = [];
  if (campaign.clientId) {
    const clientAssessments = await getClientAssessmentLibrary(
      campaign.clientId,
    );
    availableAssessments = clientAssessments.map((a) => ({
      id: a.id,
      title: a.title,
      status: a.status,
      description: a.description,
      factorCount: a.factorCount,
      sectionCount: a.sectionCount,
      totalItemCount: a.totalItemCount,
      estimatedDurationMinutes: a.estimatedDurationMinutes,
      formatLabel:
        a.formatMode === "forced_choice"
          ? "Forced-choice"
          : a.sectionCount > 1
            ? "Mixed"
            : "Traditional",
      quotaLimit: a.quotaLimit,
      quotaUsed: a.quotaUsed,
      quotaRemaining: a.quotaRemaining,
    }));
  }

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
      allAssessments={availableAssessments}
      factorPickerDataMap={factorPickerDataMap}
      constructPickerDataMap={constructPickerDataMap}
      itemSelectionRules={itemSelectionRules}
      hasCompletedParticipants={hasCompletedParticipants}
    />
  );
}
