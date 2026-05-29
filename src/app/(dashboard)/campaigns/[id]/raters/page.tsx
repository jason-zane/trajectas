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

  const setup = await getCampaign360Setup(id);

  return (
    <CampaignRatersManager
      campaignId={id}
      subject={setup.subject}
      raters={setup.raters}
    />
  );
}
