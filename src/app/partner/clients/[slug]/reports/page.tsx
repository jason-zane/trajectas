import { getReportTemplateAssignments } from "@/app/actions/client-entitlements";
import { getReportTemplates } from "@/app/actions/reports";
import { ReportAssignments } from "@/app/(dashboard)/clients/[slug]/reports/report-assignments";
import { requirePartnerClient } from "@/lib/auth/resolve-partner-client";

export default async function PartnerClientReportsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { client, partnerId } = await requirePartnerClient(slug);

  // getReportTemplates is already scoped to the caller: platform-global
  // templates plus this partner's own (D8).
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
          automatically when a participant completes an assessment are managed on
          the assessment&apos;s Reports tab.
        </p>
      </div>
      <ReportAssignments
        clientId={client.id}
        partnerId={partnerId}
        assignments={assignments}
        allTemplates={allTemplates}
      />
    </div>
  );
}
