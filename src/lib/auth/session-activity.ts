import "server-only";

import { createHmac, timingSafeEqual } from "crypto";
import {
  COOKIE_NAME,
  INACTIVITY_TIMEOUT_SECONDS,
  WARNING_THRESHOLD_SECONDS,
} from "@/lib/auth/session-activity-constants";

export { COOKIE_NAME, INACTIVITY_TIMEOUT_SECONDS, WARNING_THRESHOLD_SECONDS };

export type CookieOptions = {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax" | "strict" | "none";
  path: string;
  domain?: string;
};

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

export function encodeLastActivity(epochSeconds: number): string {
  const payload = Buffer.from(String(epochSeconds)).toString("base64url");
  const signature = signPayload(payload);
  return `${payload}.${signature}`;
}

export function decodeLastActivity(
  cookieValue: string | null | undefined
): number | null {
  if (!cookieValue) return null;

  const dotIndex = cookieValue.indexOf(".");
  if (dotIndex === -1) return null;

  const payload = cookieValue.slice(0, dotIndex);
  const signature = cookieValue.slice(dotIndex + 1);

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
    const value = parseInt(decoded, 10);
    return isNaN(value) ? null : value;
  } catch {
    return null;
  }
}

export function isSessionExpired(lastActivity: number): boolean {
  const now = Math.floor(Date.now() / 1000);
  return now - lastActivity >= INACTIVITY_TIMEOUT_SECONDS;
}

export function buildLastActivityCookieOptions(): CookieOptions {
  const domain = process.env.COOKIE_DOMAIN ?? undefined;
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    ...(domain ? { domain } : {}),
  };
}
