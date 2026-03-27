import { getCampaignById } from "@/app/actions/campaigns";
import { notFound } from "next/navigation";
import { CampaignDetailShell } from "./campaign-detail-shell";

export default async function CampaignDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const campaign = await getCampaignById(id);
  if (!campaign) notFound();

  return (
    <CampaignDetailShell campaign={campaign}>{children}</CampaignDetailShell>
  );
}
