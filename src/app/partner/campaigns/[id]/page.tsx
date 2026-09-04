import { redirect } from "next/navigation";

export default async function PartnerCampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/partner/campaigns/${id}/overview`);
}
