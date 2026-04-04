import { redirect } from "next/navigation";

export default async function OrganizationDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/organizations/${slug}/overview`);
}
