/**
 * Pure helpers for the public Role Builder's email-verification codes and the
 * pd_hash cache key. No "server-only" import — these are exercised directly
 * by unit tests and have no DB/env dependency beyond the pepper.
 */
import { createHash, randomInt } from "crypto";

function getPepper(): string {
  const pepper = process.env.TRAJECTAS_CONTEXT_SECRET;
  if (!pepper) {
    throw new Error(
      "TRAJECTAS_CONTEXT_SECRET is not set — required as the public-builds hashing pepper.",
    );
  }
  return pepper;
}

/** Six random digits, zero-padded, as a string (e.g. "038291"). */
export function generatePublicBuildCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashPublicBuildCode(code: string): string {
  return createHash("sha256").update(`${code}:${getPepper()}`).digest("hex");
}

export function verifyPublicBuildCode(code: string, hash: string): boolean {
  return hashPublicBuildCode(code) === hash;
}

export function hashIp(ip: string): string {
  return createHash("sha256").update(`${ip}:${getPepper()}`).digest("hex");
}

/** Normalise PD text before hashing so trivial whitespace/casing differences still hit the cache. */
export function normalisePdText(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

export function hashPdText(text: string): string {
  return createHash("sha256").update(normalisePdText(text)).digest("hex");
}
