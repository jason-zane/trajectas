"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { buildSurfaceUrl } from "@/lib/hosts";
import { createReportAccessToken } from "@/lib/reports/report-access-token";
import { sendEmail } from "@/lib/email/send";
import { getEffectiveBrand } from "@/app/actions/brand";
import { logActionError } from "@/lib/security/action-errors";
import { postgresUuid } from "@/lib/validations/uuid";

interface ResendResult {
  ok: true;
}

/**
 * Self-serve flow: a participant whose report link has expired submits their
 * email address; if the email matches the participant on the named snapshot
 * we issue a fresh short-lived link.
 *
 * Always returns { ok: true } regardless of whether a match was found — this
 * prevents the endpoint from confirming which (email, snapshot) pairs exist.
 * Middleware rate-limits server-action POSTs per IP.
 */
export async function requestNewReportLink(input: {
  snapshotId: string;
  email: string;
}): Promise<ResendResult> {
  try {
    const snapshotId = String(input.snapshotId ?? "").trim();
    const email = String(input.email ?? "").trim().toLowerCase();

    if (!postgresUuid().safeParse(snapshotId).success) {
      return { ok: true };
    }
    if (!email || email.length > 320 || !email.includes("@")) {
      return { ok: true };
    }

    const db = createAdminClient();

    const { data: snapshot } = await db
      .from("report_snapshots")
      .select(
        "id, campaign_id, participant_sessions!inner(campaign_participant_id, campaign_participants!inner(id, email, first_name)), campaigns(id, title, client_id, partner_id)",
      )
      .eq("id", snapshotId)
      .eq("status", "released")
      .maybeSingle();

    if (!snapshot) return { ok: true };

    const sessionRow = Array.isArray(snapshot.participant_sessions)
      ? snapshot.participant_sessions[0]
      : snapshot.participant_sessions;
    const participantRow = sessionRow
      ? Array.isArray(sessionRow.campaign_participants)
        ? sessionRow.campaign_participants[0]
        : sessionRow.campaign_participants
      : null;
    if (!participantRow) return { ok: true };

    const participantId = String(participantRow.id);
    const participantEmail = String(participantRow.email ?? "")
      .trim()
      .toLowerCase();
    if (!participantEmail || participantEmail !== email) {
      return { ok: true };
    }

    const campaign = Array.isArray(snapshot.campaigns)
      ? snapshot.campaigns[0]
      : snapshot.campaigns;
    const campaignTitle = campaign?.title ?? "Your report";
    const clientId = campaign?.client_id ? String(campaign.client_id) : undefined;

    const reportToken = createReportAccessToken(snapshotId, participantId);
    const reportUrl =
      buildSurfaceUrl(
        "assess",
        `/assess/r/${snapshotId}`,
        `t=${encodeURIComponent(reportToken)}`,
      )?.toString() ??
      `/assess/r/${snapshotId}?t=${encodeURIComponent(reportToken)}`;

    const brand = await getEffectiveBrand(clientId, campaign?.id).catch(
      () => null,
    );

    await sendEmail({
      type: "report_ready",
      to: participantEmail,
      variables: {
        recipientName: String(participantRow.first_name ?? "").trim() || "there",
        campaignTitle,
        reportUrl,
        brandName: brand?.name ?? "Trajectas",
      },
      scopeClientId: clientId,
      scopeCampaignId: campaign?.id ? String(campaign.id) : undefined,
    });

    return { ok: true };
  } catch (error) {
    logActionError("requestNewReportLink", error);
    return { ok: true };
  }
}
