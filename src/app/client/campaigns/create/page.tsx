import { resolveClientOrg } from "@/lib/auth/resolve-client-org";
import { redirect } from "next/navigation";
import { CampaignForm } from "@/app/(dashboard)/campaigns/campaign-form";

export default async function ClientCreateCampaignPage({
  searchParams,
}: {
  searchParams: Promise<{ assessmentId?: string | string[] }>;
}) {
  const { clientId } = await resolveClientOrg("/client/campaigns/create");
  if (!clientId) redirect("/client/dashboard");
  const params = await searchParams;
  const initialAssessmentId = Array.isArray(params.assessmentId)
    ? params.assessmentId[0]
    : params.assessmentId;

  return (
    <CampaignForm
      mode="create"
      defaultClientId={clientId}
      routePrefix="/client"
      initialAssessmentId={initialAssessmentId}
    />
  );
}
