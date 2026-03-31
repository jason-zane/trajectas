import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  ACTIVE_CONTEXT_COOKIE,
  PREVIEW_CONTEXT_COOKIE,
  encodeActiveContext,
  getActiveContextCookieOptions,
} from "@/lib/auth/active-context";
import {
  getActiveSupportSessionByKey,
  logAuditEvent,
} from "@/lib/auth/support-sessions";
import { getRoutePrefixForSurface, isLocalDevelopmentHost } from "@/lib/hosts";
import type { SupportSessionRecord } from "@/lib/auth/types";

function getSurfaceHomePath(
  surface: SupportSessionRecord["targetSurface"],
  request: NextRequest
) {
  const isLocalDev = isLocalDevelopmentHost(request.headers.get("host"));
  return getRoutePrefixForSurface(surface, isLocalDev) || "/";
}

function sanitizeNextPath(
  value: string | null,
  fallbackPath: string
) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return fallbackPath;
  }

  return value;
}

export async function completeSupportLaunch(
  request: NextRequest,
  surface: SupportSessionRecord["targetSurface"]
) {
  const fallbackPath = getSurfaceHomePath(surface, request);
  const supportSessionId = request.nextUrl.searchParams.get("sessionId");
  const sessionKey = request.nextUrl.searchParams.get("sessionKey");
  const nextPath = sanitizeNextPath(
    request.nextUrl.searchParams.get("next"),
    fallbackPath
  );

  if (!supportSessionId || !sessionKey) {
    return NextResponse.redirect(new URL(nextPath, request.url));
  }

  const supportSession = await getActiveSupportSessionByKey({
    supportSessionId,
    sessionKey,
    targetSurface: surface,
  });

  if (!supportSession) {
    return NextResponse.redirect(new URL(fallbackPath, request.url));
  }

  const response = NextResponse.redirect(new URL(nextPath, request.url));
  response.cookies.set(
    ACTIVE_CONTEXT_COOKIE,
    encodeActiveContext({
      surface,
      tenantType: surface,
      tenantId: supportSession.targetTenantId,
      supportSessionId: supportSession.id,
    }),
    getActiveContextCookieOptions()
  );
  response.cookies.delete(PREVIEW_CONTEXT_COOKIE);

  await logAuditEvent({
    actorProfileId: supportSession.actorProfileId,
    eventType: "support_session.handoff_completed",
    targetTable: surface === "partner" ? "partners" : "organizations",
    targetId: supportSession.targetTenantId,
    partnerId: surface === "partner" ? supportSession.targetTenantId : null,
    clientId: surface === "client" ? supportSession.targetTenantId : null,
    supportSessionId: supportSession.id,
    metadata: {
      nextPath,
      targetSurface: surface,
    },
  });

  return response;
}
