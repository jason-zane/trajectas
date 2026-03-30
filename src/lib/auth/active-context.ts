import { createHmac, timingSafeEqual } from "crypto";
import type { ActiveContext } from "@/lib/auth/types";

export const ACTIVE_CONTEXT_COOKIE = "tf_active_context";
const ACTIVE_CONTEXT_MAX_AGE_SECONDS = 60 * 60 * 8;

function getSigningSecret(): string {
  return process.env.TALENTFIT_CONTEXT_SECRET || "development-context-secret";
}

function signPayload(encodedPayload: string): string {
  return createHmac("sha256", getSigningSecret())
    .update(encodedPayload)
    .digest("base64url");
}

export function encodeActiveContext(context: ActiveContext): string {
  const payload = Buffer.from(JSON.stringify(context)).toString("base64url");
  const signature = signPayload(payload);
  return `${payload}.${signature}`;
}

export function decodeActiveContext(
  signedContext: string | null | undefined
): ActiveContext | null {
  if (!signedContext) return null;

  const [payload, signature] = signedContext.split(".");
  if (!payload || !signature) return null;

  const expectedSignature = signPayload(payload);
  const expectedBuffer = Buffer.from(expectedSignature);
  const actualBuffer = Buffer.from(signature);

  if (
    expectedBuffer.length !== actualBuffer.length ||
    !timingSafeEqual(expectedBuffer, actualBuffer)
  ) {
    return null;
  }

  try {
    const decoded = Buffer.from(payload, "base64url").toString("utf8");
    return JSON.parse(decoded) as ActiveContext;
  } catch {
    return null;
  }
}

export function getActiveContextCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ACTIVE_CONTEXT_MAX_AGE_SECONDS,
  };
}
