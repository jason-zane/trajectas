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
  response.cookies.delete(ACTIVITY_COOKIE);
  response.cookies.delete(ACTIVE_CONTEXT_COOKIE);
  response.cookies.delete(PREVIEW_CONTEXT_COOKIE);
  return response;
}
