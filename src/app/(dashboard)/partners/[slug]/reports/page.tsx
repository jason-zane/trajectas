import { notFound, redirect } from "next/navigation";
import { getPartnerBySlug } from "@/app/actions/partners";
import {
  getPartnerReportTemplateAssignments,
} from "@/app/actions/partner-entitlements";
import { getReportTemplates } from "@/app/actions/reports";
import {
  canManagePartnerDirectory,
  resolveAuthorizedScope,
} from "@/lib/auth/authorization";
import { PartnerReportAssignments } from "./partner-report-assignments";

export default async function PartnerReportsPage({
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

  const [assignments, allTemplates] = await Promise.all([
    getPartnerReportTemplateAssignments(partner.id),
    getReportTemplates(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-section">Report Template Assignments</h2>
        <p className="text-caption mt-0.5">
          Manage which report templates this partner can use for their
          client campaigns.
        </p>
      </div>
      <PartnerReportAssignments
        templates={allTemplates}
        assignments={assignments}
        partnerId={partner.id}
      />
    </div>
  );
}
