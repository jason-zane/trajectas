import { redirect } from "next/navigation";

export default async function ClientCampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/client/campaigns/${id}/overview`);
}
