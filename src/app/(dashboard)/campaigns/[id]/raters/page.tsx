import { notFound, redirect } from "next/navigation";
import { getCampaignHeader } from "@/app/actions/campaigns";
import { getCampaign360Setup } from "@/app/actions/raters";
import { CampaignRatersManager } from "./campaign-raters-manager";

export default async function CampaignRatersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const campaign = await getCampaignHeader(id);
  if (!campaign) notFound();

  // This tab only exists for 360 campaigns. Self campaigns use Participants.
  if (campaign.kind !== "leadership_360") {
    redirect(`/campaigns/${id}/participants`);
  }

  // 360 management is platform-admin only (test-bed). getCampaign360Setup throws
  // for non-admins; redirect them to the overview rather than surface an error.
  let setup;
  try {
    setup = await getCampaign360Setup(id);
  } catch {
    redirect(`/campaigns/${id}/overview`);
  }

  return (
    <CampaignRatersManager
      campaignId={id}
      subject={setup.subject}
      raters={setup.raters}
    />
  );
}
