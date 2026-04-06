import { notFound, redirect } from "next/navigation";
import { getPartnerBySlug, getPartnerStats } from "@/app/actions/partners";
import { canManagePartnerDirectory, resolveAuthorizedScope } from "@/lib/auth/authorization";
import { PartnerEditForm } from "../edit/partner-edit-form";
import { PartnerOverview } from "./partner-overview";

export default async function PartnerOverviewPage({
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

  const stats = await getPartnerStats(partner.id);

  return (
    <PartnerOverview
      partner={{ id: partner.id, name: partner.name, slug: partner.slug }}
      stats={stats}
    >
      <PartnerEditForm partner={partner} />
    </PartnerOverview>
  );
}
