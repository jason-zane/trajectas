import { notFound, redirect } from "next/navigation";
import { getPartnerBySlug } from "@/app/actions/partners";
import {
  canManagePartnerDirectory,
  resolveAuthorizedScope,
} from "@/lib/auth/authorization";
import { getPartnerTaxonomyAssignments } from "@/app/actions/partner-taxonomy";
import { LibraryTabs } from "./library-tabs";

export default async function PartnerLibraryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [partner, scope] = await Promise.all([
    getPartnerBySlug(slug),
    resolveAuthorizedScope(),
  ]);
  if (!partner) notFound();
  if (!canManagePartnerDirectory(scope)) {
    redirect("/unauthorized?reason=partner-directory");
  }

  const [dimensions, factors, constructs] = await Promise.all([
    getPartnerTaxonomyAssignments(partner.id, "dimension"),
    getPartnerTaxonomyAssignments(partner.id, "factor"),
    getPartnerTaxonomyAssignments(partner.id, "construct"),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-section">Library</h2>
        <p className="text-caption mt-0.5">
          Manage which taxonomy entities this partner can use to build
          assessments.
        </p>
      </div>
      <LibraryTabs
        partnerId={partner.id}
        dimensions={dimensions}
        factors={factors}
        constructs={constructs}
        isPlatformAdmin={scope.isPlatformAdmin}
      />
    </div>
  );
}
