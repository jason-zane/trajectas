import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAppUrl } from "@/lib/hosts";
import { sendEmail } from "@/lib/email/send";
import {
  claimPublicBuildReportSend,
  releasePublicBuildReportSend,
} from "@/lib/dal/public-builds";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = SupabaseClient<any>;

/**
 * Hook called from generateAndStoreReportPdf (src/lib/reports/pdf.ts) right
 * after a report PDF is stored. If this participant's session belongs to a
 * public Role Builder build with no report sent yet, email the PDF as an
 * attachment plus the report-page link.
 *
 * The report_sent stamp is claimed BEFORE sending: two PDF generations for
 * one snapshot can overlap (sweep + inline finalize), and only the one that
 * wins the claim sends. A failed send releases the claim and rethrows so the
 * caller's try/catch reports it and the next generation retries.
 */
export async function maybeSendPublicBuildReportEmail(
  db: DB,
  params: { participantId: string; pdfBuffer: ArrayBuffer },
): Promise<void> {
  const build = await claimPublicBuildReportSend(db, params.participantId);
  if (!build) return;

  try {
    const { data: participant, error } = await db
      .from("campaign_participants")
      .select("email, access_token")
      .eq("id", params.participantId)
      .maybeSingle();
    if (error) throw new Error(`participant lookup failed: ${error.message}`);
    if (!participant?.access_token)
      throw new Error("participant has no access token");

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
      attachments: [
        {
          filename: "report.pdf",
          content: base64,
          contentType: "application/pdf",
        },
      ],
    });
  } catch (sendError) {
    await releasePublicBuildReportSend(db, params.participantId);
    throw sendError;
  }
}
