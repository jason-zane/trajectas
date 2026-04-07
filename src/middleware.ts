import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createMiddlewareSupabaseClient } from "@/lib/supabase/middleware";
import {
  COOKIE_NAME,
  decodeLastActivity,
  encodeLastActivity,
  isSessionExpired,
  buildLastActivityCookieOptions,
} from "@/lib/auth/session-activity";

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Refresh Supabase session cookies (standard SSR pattern)
  const supabase = createMiddlewareSupabaseClient(request, response);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Unauthenticated — let Next.js handle routing (login page, public routes)
  if (!user) {
    return response;
  }

  const now = Math.floor(Date.now() / 1000);
  const activityCookie = request.cookies.get(COOKIE_NAME)?.value;
  const lastActivity = decodeLastActivity(activityCookie);

  if (lastActivity === null) {
    // First visit after login or migration — stamp activity now
    response.cookies.set(
      COOKIE_NAME,
      encodeLastActivity(now),
      buildLastActivityCookieOptions()
    );
    return response;
  }

  if (isSessionExpired(lastActivity)) {
    return NextResponse.redirect(new URL("/auth/expire", request.url));
  }

  // Valid session — slide the activity window
  response.cookies.set(
    COOKIE_NAME,
    encodeLastActivity(now),
    buildLastActivityCookieOptions()
  );
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static, _next/image (Next.js internals)
     * - favicon.ico, robots.txt, sitemap.xml (static assets)
     * - /login (unauthenticated entry point)
     * - /auth/callback, /auth/accept, /auth/expire (auth routes)
     * - /assess/* (assessment participants — no inactivity timeout)
     * - /api/auth/send-email (unauthenticated magic link API)
     */
    "/((?!_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap\\.xml|login|auth/callback|auth/accept|auth/expire|assess/|api/auth/send-email).*)",
  ],
};
