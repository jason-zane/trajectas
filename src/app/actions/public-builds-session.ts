"use server";

import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { PUBLIC_BUILD_COOKIE, decodePublicBuildCookie } from "@/lib/public-builds/cookie";
import { getPublicBuildsMode } from "@/lib/public-builds/constants";
import { getResumablePublicBuild } from "@/lib/dal/public-builds";
import { logActionError } from "@/lib/security/action-errors";
import type { PublicBuildSession } from "@/lib/public-builds/session";

/** Read-only recovery. Email is always taken from the signed cookie, never a client argument. */
export async function getPublicBuildSession(): Promise<PublicBuildSession | { error: string }> {
  if (getPublicBuildsMode() === "off") return { email: null, build: null };
  const context = decodePublicBuildCookie((await cookies()).get(PUBLIC_BUILD_COOKIE)?.value);
  if (!context) return { email: null, build: null };
  try {
    return { email: context.email, build: await getResumablePublicBuild(createAdminClient(), context.email) };
  } catch (error) {
    logActionError("publicBuilds.session", error);
    return { error: "We couldn’t recover your progress. Try again before starting a new assessment." };
  }
}
