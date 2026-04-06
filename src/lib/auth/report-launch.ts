import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  buildSurfaceUrl,
  getRoutePrefixForSurface,
  isLocalDevelopmentHost,
} from "@/lib/hosts";
import { requireParticipantAccess } from "@/lib/auth/authorization";
import { logAuditEvent } from "@/lib/auth/support-sessions";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AuthorizedScope } from "@/lib/auth/authorization";

function buildParticipantReportUrl(
  request: NextRequest,
  token: string
) {
  const pathname = `/assess/${token}/report`;
  return buildSurfaceUrl("assess", pathname) ?? new URL(pathname, request.url);
}

function buildParticipantExportUrl(
  request: NextRequest,
  token: string
) {
  const pathname = `/assess/${token}/report/export`;
  return buildSurfaceUrl("assess", pathname) ?? new URL(pathname, request.url);
}

function buildWorkspaceHomeUrl(
  request: NextRequest,
  surface: "partner" | "client"
) {
  const pathname =
    getRoutePrefixForSurface(
      surface,
      isLocalDevelopmentHost(request.headers.get("host"))
    ) || "/";
  return new URL(pathname, request.url);
}

function canExportParticipantReport(
  scope: AuthorizedScope,
  input: {
    surface: "partner" | "client";
    partnerId: string | null;
    clientId: string | null;
  }
) {
  if (scope.isLocalDevelopmentBypass || scope.isPlatformAdmin) {
    return true;
  }

  if (input.surface === "partner" && input.partnerId) {
    return scope.partnerAdminIds.includes(input.partnerId);
  }

  if (input.surface === "client" && input.clientId) {
    return scope.clientAdminIds.includes(input.clientId);
  }

  return false;
}

async function getParticipantLaunchContext(participantId: string) {
  const access = await requireParticipantAccess(participantId);
  const db = createAdminClient();
  const { data: participant, error } = await db
    .from("campaign_participants")
    .select("id, access_token, status")
    .eq("id", participantId)
    .single();

  if (error || !participant?.access_token) {
    return null;
  }

  return {
    access,
    participant,
    accessToken: String(participant.access_token),
  };
}

/**
 * Find the latest ready/released snapshot for a participant's sessions,
 * filtered by audience type. Returns the snapshot ID or null.
 */
async function findSnapshotForParticipant(
  participantId: string,
  audienceType: "participant" | "hr_manager" | "consultant"
): Promise<string | null> {
  const db = createAdminClient();

  // Get completed sessions for this participant
  const { data: sessions } = await db
    .from("participant_sessions")
    .select("id")
    .eq("campaign_participant_id", participantId)
    .eq("status", "completed");

  if (!sessions?.length) return null;

  const sessionIds = sessions.map((s: { id: string }) => s.id);

  const { data: snapshot } = await db
    .from("report_snapshots")
    .select("id")
    .in("participant_session_id", sessionIds)
    .eq("audience_type", audienceType)
    .eq("status", "released")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return snapshot?.id ?? null;
}

export async function launchParticipantReport(
  request: NextRequest,
  surface: "partner" | "client",
  participantId: string
) {
  let context;
  try {
    context = await getParticipantLaunchContext(participantId);
  } catch {
    return NextResponse.redirect(buildWorkspaceHomeUrl(request, surface));
  }

  if (!context) {
    return NextResponse.redirect(buildWorkspaceHomeUrl(request, surface));
  }

  await logAuditEvent({
    actorProfileId: context.access.scope.actor?.id ?? null,
    eventType: "participant_report.launch_requested",
    targetTable: "campaign_participants",
    targetId: String(context.participant.id),
    partnerId: context.access.partnerId,
    clientId: context.access.clientId,
    metadata: {
      participantStatus: context.participant.status,
      launchedFromSurface: surface,
      isLocalDevelopmentBypass: context.access.scope.isLocalDevelopmentBypass,
    },
  });

  // For portal launches, try to route to the dashboard snapshot viewer
  // with the appropriate audience type for this surface
  const audienceType = surface === "client" ? "hr_manager" : "consultant";
  const snapshotId = await findSnapshotForParticipant(participantId, audienceType);

  if (snapshotId) {
    return NextResponse.redirect(
      new URL(`/reports/${snapshotId}`, request.url)
    );
  }

  // Fall back to the participant runtime report page
  return NextResponse.redirect(
    buildParticipantReportUrl(request, context.accessToken)
  );
}

export async function launchParticipantExport(
  request: NextRequest,
  surface: "partner" | "client",
  participantId: string
) {
  let context;
  try {
    context = await getParticipantLaunchContext(participantId);
  } catch {
    return NextResponse.redirect(buildWorkspaceHomeUrl(request, surface));
  }

  if (!context) {
    return NextResponse.redirect(buildWorkspaceHomeUrl(request, surface));
  }

  if (
    !canExportParticipantReport(context.access.scope, {
      surface,
      partnerId: context.access.partnerId,
      clientId: context.access.clientId,
    })
  ) {
    return NextResponse.redirect(buildWorkspaceHomeUrl(request, surface));
  }

  await logAuditEvent({
    actorProfileId: context.access.scope.actor?.id ?? null,
    eventType: "participant_report.export_requested",
    targetTable: "campaign_participants",
    targetId: String(context.participant.id),
    partnerId: context.access.partnerId,
    clientId: context.access.clientId,
    metadata: {
      participantStatus: context.participant.status,
      launchedFromSurface: surface,
      isLocalDevelopmentBypass: context.access.scope.isLocalDevelopmentBypass,
    },
  });

  return NextResponse.redirect(
    buildParticipantExportUrl(request, context.accessToken)
  );
}
