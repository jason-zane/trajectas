import { getOrganizationBySlug } from "@/app/actions/organizations";
import { notFound } from "next/navigation";
import { OrganizationDetailShell } from "./organization-detail-shell";

export default async function OrganizationDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const organization = await getOrganizationBySlug(slug, {
    includeArchived: true,
  });
  if (!organization) notFound();

  return (
    <OrganizationDetailShell organization={organization}>
      {children}
    </OrganizationDetailShell>
  );
}
