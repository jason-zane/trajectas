import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ACTIVE_CONTEXT_COOKIE, PREVIEW_CONTEXT_COOKIE } from "@/lib/auth/active-context";
import { signOutStaff } from "@/app/actions/auth";

export async function GET(request: NextRequest) {
  try {
    await signOutStaff()
  } catch {
    // Ignore sign-out provider errors and still clear local cookies.
  }

  const cookieStore = await cookies()
  cookieStore.delete(ACTIVE_CONTEXT_COOKIE)
  cookieStore.delete(PREVIEW_CONTEXT_COOKIE)

  const response = NextResponse.redirect(new URL('/login', request.url))
  response.cookies.delete(ACTIVE_CONTEXT_COOKIE)
  response.cookies.delete(PREVIEW_CONTEXT_COOKIE)
  return response
}
