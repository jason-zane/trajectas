import { createHmac, timingSafeEqual } from "crypto";
import type { ActiveContext, PreviewContext } from "@/lib/auth/types";

export const ACTIVE_CONTEXT_COOKIE = "tf_active_context";
export const PREVIEW_CONTEXT_COOKIE = "tf_preview_context";
function getSigningSecret(): string {
  const secret = process.env.TRAJECTAS_CONTEXT_SECRET;
  if (!secret) {
    throw new Error(
      "TRAJECTAS_CONTEXT_SECRET is not set. " +
      "This environment variable is required for secure cookie signing. " +
      "Generate one with: openssl rand -base64 32"
    );
  }
  return secret;
}

function signPayload(encodedPayload: string): string {
  return createHmac("sha256", getSigningSecret())
    .update(encodedPayload)
    .digest("base64url");
}

function encodeSignedContext<T extends object>(context: T): string {
  const payload = Buffer.from(JSON.stringify(context)).toString("base64url");
  const signature = signPayload(payload);
  return `${payload}.${signature}`;
}

function decodeSignedContext<T extends object>(
  signedContext: string | null | undefined
): T | null {
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
    return JSON.parse(decoded) as T;
  } catch {
    return null;
  }
}

function getContextCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}

export function encodeActiveContext(context: ActiveContext): string {
  return encodeSignedContext(context);
}

export function decodeActiveContext(
  signedContext: string | null | undefined
): ActiveContext | null {
  return decodeSignedContext<ActiveContext>(signedContext);
}

export function encodePreviewContext(context: PreviewContext): string {
  return encodeSignedContext(context);
}

export function decodePreviewContext(
  signedContext: string | null | undefined
): PreviewContext | null {
  return decodeSignedContext<PreviewContext>(signedContext);
}

export function getActiveContextCookieOptions() {
  return getContextCookieOptions();
}

export function getPreviewContextCookieOptions() {
  return getContextCookieOptions();
}
