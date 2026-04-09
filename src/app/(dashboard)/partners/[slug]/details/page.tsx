import { notFound, redirect } from "next/navigation";
import { getPartnerBySlug } from "@/app/actions/partners";
import { canManagePartnerDirectory, resolveAuthorizedScope } from "@/lib/auth/authorization";
import { PartnerDetailsForm } from "./partner-details-form";

export default async function PartnerDetailsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [partner, scope] = await Promise.all([
    getPartnerBySlug(slug, { includeArchived: true }),
    resolveAuthorizedScope(),
  ]);
  if (!partner) notFound();
  if (!canManagePartnerDirectory(scope)) {
    redirect("/unauthorized?reason=partner-directory");
  }

  return <PartnerDetailsForm partner={partner} />;
}
