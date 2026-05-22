import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  ACTIVE_CONTEXT_COOKIE,
  PREVIEW_CONTEXT_COOKIE,
} from "@/lib/auth/active-context";
import { COOKIE_NAME as ACTIVITY_COOKIE } from "@/lib/auth/session-activity";

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();

  const response = NextResponse.redirect(
    new URL("/login?error=session_expired", request.url)
  );
  // Clear all known cookie-domain variants so a cookie set previously with a
  // different domain scope (e.g. host-only vs .trajectas.com) can't shadow
  // the fresh one set on the next sign-in. response.cookies.delete only
  // targets the host-only variant.
  const cookieDomain = process.env.COOKIE_DOMAIN;
  const clearVariants = [
    { path: "/" },
    ...(cookieDomain ? [{ path: "/", domain: cookieDomain }] : []),
  ];
  for (const name of [ACTIVITY_COOKIE, ACTIVE_CONTEXT_COOKIE, PREVIEW_CONTEXT_COOKIE]) {
    for (const opts of clearVariants) {
      response.cookies.set(name, "", { ...opts, maxAge: 0 });
    }
  }
  return response;
}
