import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { resolveSessionActor } from "@/lib/auth/actor";
import { finalizeInviteAcceptance, buildSurfaceDestinationUrl, resolveDefaultWorkspaceContext, applyActiveContextToResponse } from "@/lib/auth/staff-auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ACTIVE_CONTEXT_COOKIE, PREVIEW_CONTEXT_COOKIE } from "@/lib/auth/active-context";
import {
  COOKIE_NAME as ACTIVITY_COOKIE,
  encodeLastActivity,
  buildLastActivityCookieOptions,
} from "@/lib/auth/session-activity";

function sanitizeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  return value;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const inviteToken = url.searchParams.get("invite");
  const nextPath = sanitizeNextPath(url.searchParams.get("next"));

  const supabase = await createServerSupabaseClient();

  if (code) {
    // PKCE flow: exchange the authorization code for a session.
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(new URL("/login?error=callback_failed", request.url));
    }
  }
  // Implicit flow: /auth/confirm already set the session via browser-side
  // setSession(), so the session cookie is present — no code exchange needed.

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login?error=session_missing", request.url));
  }

  if (inviteToken) {
    try {
      await finalizeInviteAcceptance(user, inviteToken);
    } catch {
      return NextResponse.redirect(new URL("/unauthorized?reason=invite", request.url));
    }
  }

  const actor = await resolveSessionActor();

  if (!actor?.isActive) {
    const response = NextResponse.redirect(new URL("/unauthorized?reason=inactive", request.url));
    response.cookies.delete(ACTIVE_CONTEXT_COOKIE);
    response.cookies.delete(PREVIEW_CONTEXT_COOKIE);
    return response;
  }

  const hasWorkspaceAccess =
    actor.role === "platform_admin" ||
    actor.partnerMemberships.length > 0 ||
    actor.clientMemberships.length > 0;

  if (!hasWorkspaceAccess) {
    const response = NextResponse.redirect(new URL("/unauthorized?reason=membership", request.url));
    response.cookies.delete(ACTIVE_CONTEXT_COOKIE);
    response.cookies.delete(PREVIEW_CONTEXT_COOKIE);
    return response;
  }

  const context = resolveDefaultWorkspaceContext(actor);
  const destination = buildSurfaceDestinationUrl({
    surface: context.surface,
    path: nextPath,
    requestUrl: request.url,
    host: (await headers()).get("host"),
  });

  const response = NextResponse.redirect(destination);

  // Stamp initial activity on login
  response.cookies.set(
    ACTIVITY_COOKIE,
    encodeLastActivity(Math.floor(Date.now() / 1000)),
    buildLastActivityCookieOptions()
  );

  const cookieStore = await cookies();
  if (context.surface === "admin") {
    cookieStore.delete(ACTIVE_CONTEXT_COOKIE);
    cookieStore.delete(PREVIEW_CONTEXT_COOKIE);
    response.cookies.delete(ACTIVE_CONTEXT_COOKIE);
    response.cookies.delete(PREVIEW_CONTEXT_COOKIE);
    return response;
  }

  return applyActiveContextToResponse(response, context);
}
