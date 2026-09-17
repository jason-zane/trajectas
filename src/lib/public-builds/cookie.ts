import "server-only";

import { encodeSignedContext, decodeSignedContext } from "@/lib/auth/active-context";
import { PUBLIC_BUILDS_COOKIE_TTL_MS } from "./constants";

export const PUBLIC_BUILD_COOKIE = "tf_public_build";

export interface PublicBuildCookieContext {
  email: string;
  verifiedAt: number;
  exp: number;
}

/** Issued by verifyCode. Every later public-builds action reads this cookie; none takes the email from the client. */
export function encodePublicBuildCookie(email: string): string {
  const now = Date.now();
  return encodeSignedContext<PublicBuildCookieContext>({
    email,
    verifiedAt: now,
    exp: now + PUBLIC_BUILDS_COOKIE_TTL_MS,
  });
}

export function decodePublicBuildCookie(
  signedCookie: string | null | undefined,
): PublicBuildCookieContext | null {
  const decoded = decodeSignedContext<PublicBuildCookieContext>(signedCookie);
  if (!decoded) return null;
  if (typeof decoded.exp !== "number" || decoded.exp <= Date.now()) return null;
  if (typeof decoded.email !== "string" || !decoded.email) return null;
  return decoded;
}

export function getPublicBuildCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(PUBLIC_BUILDS_COOKIE_TTL_MS / 1000),
  };
}
