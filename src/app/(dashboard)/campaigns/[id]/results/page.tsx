import { notFound, redirect } from "next/navigation";
import { getCampaignHeader } from "@/app/actions/campaigns";
import { getCampaign360Snapshot } from "@/app/actions/three-sixty";
import { Campaign360Report } from "./campaign-360-report";

export default async function Campaign360ResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const campaign = await getCampaignHeader(id);
  if (!campaign) notFound();

  // Results only exist for 360 campaigns; self campaigns report per participant.
  if (campaign.kind !== "leadership_360") {
    redirect(`/campaigns/${id}/overview`);
  }

  // getCampaign360Snapshot is platform-admin only; redirect non-admins.
  let snapshot;
  try {
    snapshot = await getCampaign360Snapshot(id);
  } catch {
    redirect(`/campaigns/${id}/overview`);
  }

  return (
    <Campaign360Report
      campaignId={id}
      subjectName={campaign.title}
      snapshot={snapshot}
    />
  );
}
