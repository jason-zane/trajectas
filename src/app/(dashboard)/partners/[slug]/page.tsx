import { redirect } from "next/navigation";

export default async function PartnerDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/partners/${slug}/overview`);
}
