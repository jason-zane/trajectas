import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAppUrl } from "@/lib/hosts";
import { sendEmail } from "@/lib/email/send";
import { getPublicBuildByParticipantId, markPublicBuildReportSent } from "@/lib/dal/public-builds";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = SupabaseClient<any>;

/**
 * Hook called from generateAndStoreReportPdf (src/lib/reports/pdf.ts) right
 * after a report PDF is stored. If this participant's session belongs to a
 * public Role Builder build with no report sent yet, email the PDF as an
 * attachment plus the report-page link, then stamp report_sent.
 *
 * Never throws — a failure here must not fail report PDF generation for
 * everyone else. Callers wrap this in their own try/catch and log instead.
 */
export async function maybeSendPublicBuildReportEmail(
  db: DB,
  params: { participantId: string; pdfBuffer: ArrayBuffer },
): Promise<void> {
  const build = await getPublicBuildByParticipantId(db, params.participantId);
  if (!build || build.reportSentAt) return;

  const { data: participant, error } = await db
    .from("campaign_participants")
    .select("email, access_token")
    .eq("id", params.participantId)
    .maybeSingle();
  if (error || !participant?.access_token) return;

  const reportUrl = `${requireAppUrl("public")}/assess/${participant.access_token}/report`;
  const base64 = Buffer.from(params.pdfBuffer).toString("base64");

  await sendEmail({
    type: "public_build_report",
    to: participant.email,
    variables: {
      roleTitle: build.roleTitle || "this role",
      reportUrl,
      brandName: "Trajectas",
    },
    scopeCampaignId: build.campaignId ?? undefined,
    attachments: [{ filename: "report.pdf", content: base64, contentType: "application/pdf" }],
  });

  await markPublicBuildReportSent(db, params.participantId);
}
