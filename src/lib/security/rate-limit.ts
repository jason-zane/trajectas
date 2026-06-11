import { createHash } from "crypto";
import type { NextRequest } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { reportError } from "@/lib/observability/report-error";

type SlidingWindowStore = Map<string, number[]>;

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
};

type RateLimitRule = {
  key: string;
  limit: number;
  windowMs: number;
  /**
   * When Redis is configured but errors, fail-closed rules deny requests (429)
   * instead of falling back to in-memory. This protects cost-bearing operations.
   * Defaults to false (allow fallback).
   */
  failClosed?: boolean;
};

// ---------------------------------------------------------------------------
// Redis-backed store (Upstash via Vercel Marketplace)
// ---------------------------------------------------------------------------

function getRedisClient(): Redis | null {
  const url =
    process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

const redis = getRedisClient();
let warnedInMemoryFallback = false;

// Ratelimit instances are keyed on (limit, windowMs) so we share one per
// unique rule config across requests.
const ratelimitCache = new Map<string, Ratelimit>();

function getRatelimit(limit: number, windowMs: number): Ratelimit | null {
  if (!redis) return null;
  const key = `${limit}:${windowMs}`;
  const cached = ratelimitCache.get(key);
  if (cached) return cached;
  const instance = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, `${windowMs} ms`),
    analytics: false,
    prefix: "trajectas-rl",
  });
  ratelimitCache.set(key, instance);
  return instance;
}

function warnIfProductionInMemoryFallback(reason: string) {
  if (process.env.NODE_ENV !== "production" || warnedInMemoryFallback) return;
  warnedInMemoryFallback = true;
  console.warn(
    `[rate-limit] Using in-memory fallback in production (${reason}). Configure Upstash/KV for distributed limits.`,
  );
}

// ---------------------------------------------------------------------------
// In-memory fallback (used in dev and when Redis isn't configured)
// ---------------------------------------------------------------------------

function getStore() {
  const globalStore = globalThis as typeof globalThis & {
    __trajectasRateLimitStore?: SlidingWindowStore;
  };

  if (!globalStore.__trajectasRateLimitStore) {
    globalStore.__trajectasRateLimitStore = new Map();
  }

  return globalStore.__trajectasRateLimitStore;
}

function applyRuleInMemory(rule: RateLimitRule): RateLimitResult {
  const store = getStore();
  const now = Date.now();
  const cutoff = now - rule.windowMs;
  const timestamps = (store.get(rule.key) ?? []).filter(
    (timestamp) => timestamp > cutoff,
  );

  if (timestamps.length >= rule.limit) {
    const retryAfterMs = Math.max(rule.windowMs - (now - timestamps[0]), 1_000);
    store.set(rule.key, timestamps);
    return {
      allowed: false,
      limit: rule.limit,
      remaining: 0,
      retryAfterSeconds: Math.ceil(retryAfterMs / 1_000),
    };
  }

  timestamps.push(now);
  store.set(rule.key, timestamps);

  if (store.size > 2_048) {
    for (const [key, values] of store.entries()) {
      const nextValues = values.filter((timestamp) => timestamp > cutoff);
      if (nextValues.length === 0) {
        store.delete(key);
      } else if (nextValues.length !== values.length) {
        store.set(key, nextValues);
      }
    }
  }

  return {
    allowed: true,
    limit: rule.limit,
    remaining: Math.max(rule.limit - timestamps.length, 0),
    retryAfterSeconds: 0,
  };
}

// ---------------------------------------------------------------------------
// Rule resolution
// ---------------------------------------------------------------------------

function hashValue(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 24);
}

function getClientIp(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? "unknown";
  }

  return request.headers.get("x-real-ip") ?? "unknown";
}

function getSupabaseSessionFingerprint(request: NextRequest) {
  const authCookies = request.cookies
    .getAll()
    .filter(
      (cookie) =>
        /^sb-.*auth-token(?:\.\d+)?$/i.test(cookie.name) ||
        cookie.name === "sb-access-token" ||
        cookie.name === "sb-refresh-token",
    )
    .sort((left, right) => left.name.localeCompare(right.name));

  if (authCookies.length === 0) {
    return null;
  }

  return hashValue(authCookies.map((cookie) => cookie.value).join("."));
}

function userBucket(request: NextRequest, ip: string): string {
  return getSupabaseSessionFingerprint(request) ?? ip;
}

function resolveRule(request: NextRequest): RateLimitRule | null {
  const pathname = request.nextUrl.pathname;
  const ip = getClientIp(request);

  if (pathname === "/api/reports/generate") {
    const internalKey = request.headers.get("x-internal-key");
    const bucket = internalKey
      ? `internal:${hashValue(internalKey)}`
      : `user:${userBucket(request, ip)}`;
    return {
      key: `reports:${bucket}`,
      limit: 30,
      windowMs: 60_000,
    };
  }

  if (
    pathname.startsWith("/api/reports/") &&
    pathname.endsWith("/pdf")
  ) {
    return {
      key: `pdf:${userBucket(request, ip)}`,
      limit: 20,
      windowMs: 60_000,
      failClosed: true, // PDF generation is expensive
    };
  }

  if (request.method !== "POST") {
    return null;
  }

  if (
    pathname === "/login" ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/auth/")
  ) {
    return {
      key: `login:${ip}`,
      limit: 10,
      windowMs: 60_000,
      // Login: allow in-memory fallback to avoid locking users out on Redis blip
      failClosed: false,
    };
  }

  if (pathname.startsWith("/assess/join/")) {
    return {
      key: `assess-join:${ip}`,
      limit: 10,
      windowMs: 60_000,
    };
  }

  if (pathname === "/api/chat") {
    return {
      key: `chat:${userBucket(request, ip)}`,
      limit: 30,
      windowMs: 60_000,
      failClosed: true, // Chat is an expensive operation
    };
  }

  if (pathname === "/api/generation/start") {
    return {
      key: `gen-start:${userBucket(request, ip)}`,
      limit: 10,
      windowMs: 60_000,
      failClosed: true, // Generation is an expensive operation
    };
  }

  if (request.headers.has("next-action")) {
    return {
      key: `action:${userBucket(request, ip)}`,
      limit: 60,
      windowMs: 60_000,
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Public entry
// ---------------------------------------------------------------------------

/**
 * Check the rate-limit bucket for this request. Uses Upstash Redis when
 * configured via env (UPSTASH_REDIS_REST_URL / KV_REST_API_URL), otherwise
 * falls back to an in-memory per-process sliding window. The in-memory
 * fallback is not distributed across Vercel Fluid Compute instances — use
 * Upstash in any deployed environment.
 *
 * For failClosed rules (cost-bearing operations), if Redis is configured
 * but errors, the request is denied (429) rather than falling back. If Redis
 * is not configured at all (local dev), the in-memory fallback is used.
 */
export async function checkRequestRateLimit(
  request: NextRequest,
): Promise<RateLimitResult | null> {
  const rule = resolveRule(request);
  if (!rule) {
    return null;
  }

  const ratelimit = getRatelimit(rule.limit, rule.windowMs);
  if (ratelimit) {
    try {
      const result = await ratelimit.limit(rule.key);
      const retryAfterSeconds = result.success
        ? 0
        : Math.max(Math.ceil((result.reset - Date.now()) / 1_000), 1);
      return {
        allowed: result.success,
        limit: result.limit,
        remaining: result.remaining,
        retryAfterSeconds,
      };
    } catch (error) {
      // Redis is configured but erroring. Report the issue, then decide
      // whether to deny (failClosed) or fall back (default).
      reportError(error, {
        source: "rate-limit.redis_error",
        severity: "warning",
        context: {
          rule_key: rule.key,
          fail_closed: rule.failClosed ?? false,
        },
        alert: false,
      }).catch(() => {
        // Swallow reportError failures so instrumentation doesn't break the path
      });

      console.warn("[rate-limit] Upstash error:", error);

      if (rule.failClosed) {
        // For cost-bearing routes, deny on Redis error rather than falling back
        return {
          allowed: false,
          limit: rule.limit,
          remaining: 0,
          retryAfterSeconds: 60,
        };
      }

      // For other routes, fall back to in-memory
      warnIfProductionInMemoryFallback("redis_error");
    }
  } else {
    warnIfProductionInMemoryFallback("redis_not_configured");
  }

  return applyRuleInMemory(rule);
}

/**
 * Check a rate-limit bucket for an arbitrary key, with optional failClosed behavior.
 * Used for action-layer rate limiting (e.g., per-email OTP requests).
 *
 * @param key - The rate-limit bucket key (e.g., "otp-email:user@example.com")
 * @param limit - Number of requests allowed per window
 * @param windowMs - Time window in milliseconds
 * @param failClosed - If true and Redis is configured but errors, deny (429).
 *                     If false, fall back to in-memory. Irrelevant if Redis not configured.
 *
 * @returns RateLimitResult with allowed status, or null if rate-limit is not applicable.
 */
export async function checkKeyedRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  failClosed: boolean = false,
): Promise<RateLimitResult | null> {
  const ratelimit = getRatelimit(limit, windowMs);

  if (ratelimit) {
    try {
      const result = await ratelimit.limit(key);
      const retryAfterSeconds = result.success
        ? 0
        : Math.max(Math.ceil((result.reset - Date.now()) / 1_000), 1);
      return {
        allowed: result.success,
        limit: result.limit,
        remaining: result.remaining,
        retryAfterSeconds,
      };
    } catch (error) {
      // Redis is configured but erroring.
      reportError(error, {
        source: "rate-limit.keyed.redis_error",
        severity: "warning",
        context: {
          key_prefix: key.split(":")[0] ?? "unknown",
          fail_closed: failClosed,
        },
        alert: false,
      }).catch(() => {
        // Swallow reportError failures
      });

      console.warn("[rate-limit.keyed] Upstash error:", error);

      if (failClosed) {
        return {
          allowed: false,
          limit,
          remaining: 0,
          retryAfterSeconds: 60,
        };
      }

      // Fall back to in-memory
      warnIfProductionInMemoryFallback("redis_error");
    }
  } else {
    warnIfProductionInMemoryFallback("redis_not_configured");
  }

  // Use in-memory fallback (either because Redis not configured or because
  // we're OK with fallback for this operation)
  const rule: RateLimitRule = { key, limit, windowMs };
  return applyRuleInMemory(rule);
}
