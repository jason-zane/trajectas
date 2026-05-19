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
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Report library</h1>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Reports listed here are available for this client to attach to their
          campaigns. This is a visibility allow-list only — reports that fire
          automatically when a participant completes an assessment are managed
          on the assessment&apos;s Reports tab.
        </p>
      </div>
      <ReportAssignments
        clientId={client.id}
        partnerId={client.partnerId ?? null}
        assignments={assignments}
        allTemplates={allTemplates}
      />
    </div>
  );
}
