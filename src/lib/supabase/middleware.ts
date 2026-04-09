import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";

const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN ?? undefined;

export function createMiddlewareSupabaseClient(
  request: NextRequest,
  response: NextResponse
) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            // Strip maxAge/expires — session-only cookies
            const sessionOptions = { ...(options ?? {}) };
            delete sessionOptions.maxAge;
            delete sessionOptions.expires;
            const cookieOptions = {
              ...sessionOptions,
              ...(COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {}),
            };
            request.cookies.set(name, value);
            response.cookies.set(name, value, cookieOptions);
          });
        },
      },
    }
  );
}
