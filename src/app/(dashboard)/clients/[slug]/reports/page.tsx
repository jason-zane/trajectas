import { getClientBySlug } from "@/app/actions/clients";
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
  const client = await getClientBySlug(slug);
  if (!client) notFound();

  const [assignments, allTemplates] = await Promise.all([
    getReportTemplateAssignments(client.id),
    getReportTemplates(),
  ]);

  return (
    <ReportAssignments
      clientId={client.id}
      partnerId={client.partnerId ?? null}
      assignments={assignments}
      allTemplates={allTemplates}
    />
  );
}
