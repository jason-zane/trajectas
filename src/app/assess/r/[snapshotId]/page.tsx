import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReportRenderer } from "@/components/reports/report-renderer";
import { createAdminClient } from "@/lib/supabase/admin";
import { mapReportSnapshotRow } from "@/lib/supabase/mappers";
import { verifyReportAccessToken } from "@/lib/reports/report-access-token";
import { buildSurfaceUrl } from "@/lib/hosts";
import type { ResolvedBlockData } from "@/lib/reports/types";

interface Props {
  params: Promise<{ snapshotId: string }>;
  searchParams: Promise<{ t?: string }>;
}

/**
 * HMAC-gated report viewer for participants. The `t` query parameter is a
 * short-lived signed token (see REPORT_ACCESS_TOKEN_TTL_SECONDS). An expired
 * or tampered token redirects to the self-serve resend page. This route
 * deliberately does not touch the persistent participant access_token —
 * those are scoped to the survey-taking flow only.
 */
export default async function ReportByTokenPage({
  params,
  searchParams,
}: Props) {
  const { snapshotId } = await params;
  const { t: reportToken } = await searchParams;

  const payload = verifyReportAccessToken(reportToken ?? null, snapshotId);
  if (!payload) {
    redirect(`/assess/report-expired?snapshotId=${encodeURIComponent(snapshotId)}`);
  }

  const db = createAdminClient();
  const { data, error } = await db
    .from("report_snapshots")
    .select("*, participant_sessions!inner(campaign_participant_id)")
    .eq("id", snapshotId)
    .eq("status", "released")
    .maybeSingle();

  if (error || !data) {
    redirect(`/assess/report-expired?snapshotId=${encodeURIComponent(snapshotId)}`);
  }

  const session = Array.isArray(data.participant_sessions)
    ? data.participant_sessions[0]
    : (data.participant_sessions as
        | { campaign_participant_id: string | null }
        | null);

  if (
    !session?.campaign_participant_id ||
    String(session.campaign_participant_id) !== payload.participantId
  ) {
    redirect(`/assess/report-expired?snapshotId=${encodeURIComponent(snapshotId)}`);
  }

  const snapshot = mapReportSnapshotRow(data);
  const blocks = (snapshot.renderedData ?? []) as ResolvedBlockData[];

  const pdfDownloadUrl =
    buildSurfaceUrl(
      "admin",
      `/api/reports/${snapshotId}/pdf`,
      `reportToken=${encodeURIComponent(reportToken!)}`,
    )?.toString() ??
    `/api/reports/${snapshotId}/pdf?reportToken=${encodeURIComponent(reportToken!)}`;

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-16 p-6">
      <div className="flex justify-end">
        <a href={pdfDownloadUrl} download>
          <Button variant="outline">
            <Download className="size-4" />
            Download Report
          </Button>
        </a>
      </div>
      <div className="space-y-8">
        <Suspense>
          <ReportRenderer blocks={blocks} />
        </Suspense>
      </div>
    </div>
  );
}
