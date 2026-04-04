import { getOrganizationBySlug } from "@/app/actions/organizations";
import { getReportTemplateAssignments } from "@/app/actions/client-entitlements";
import { getReportTemplates } from "@/app/actions/reports";
import { notFound } from "next/navigation";
import { ReportAssignments } from "./report-assignments";

export default async function OrgReportsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const organization = await getOrganizationBySlug(slug);
  if (!organization) notFound();

  const [assignments, allTemplates] = await Promise.all([
    getReportTemplateAssignments(organization.id),
    getReportTemplates(),
  ]);

  return (
    <ReportAssignments
      organizationId={organization.id}
      partnerId={organization.partnerId ?? null}
      assignments={assignments}
      allTemplates={allTemplates}
    />
  );
}
