import { redirect } from "next/navigation";

export default async function PartnerClientDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/partner/clients/${slug}/overview`);
}
