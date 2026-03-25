import { notFound } from "next/navigation";
import { getOrganizationBySlug } from "@/app/actions/organizations";
import { OrganizationEditForm } from "./organization-edit-form";

export default async function EditOrganizationPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const organization = await getOrganizationBySlug(slug);
  if (!organization) notFound();

  return <OrganizationEditForm organization={organization} />;
}
