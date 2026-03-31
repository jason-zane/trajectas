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
    clientId: context.access.organizationId,
    metadata: {
      participantStatus: context.participant.status,
      launchedFromSurface: surface,
      isLocalDevelopmentBypass: context.access.scope.isLocalDevelopmentBypass,
    },
  });

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
      clientId: context.access.organizationId,
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
    clientId: context.access.organizationId,
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
