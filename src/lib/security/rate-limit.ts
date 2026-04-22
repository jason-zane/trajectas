import { createHash } from "crypto";
import type { NextRequest } from "next/server";

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
};

function getStore() {
  const globalStore = globalThis as typeof globalThis & {
    __trajectasRateLimitStore?: SlidingWindowStore;
  };

  if (!globalStore.__trajectasRateLimitStore) {
    globalStore.__trajectasRateLimitStore = new Map();
  }

  return globalStore.__trajectasRateLimitStore;
}

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
        cookie.name === "sb-refresh-token"
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
    // Key internal (server-to-server) calls by the signing key; key admin-user
    // calls by session fingerprint so one admin can't starve the others.
    const bucket = internalKey
      ? `internal:${hashValue(internalKey)}`
      : `user:${userBucket(request, ip)}`;
    return {
      key: `reports:${bucket}`,
      limit: 30,
      windowMs: 60_000,
    };
  }

  // PDF generation / download endpoint — expensive (spawns puppeteer).
  // Applies to both GET and POST since the GET path can trigger generation.
  if (
    pathname.startsWith("/api/reports/") &&
    pathname.endsWith("/pdf")
  ) {
    return {
      key: `pdf:${userBucket(request, ip)}`,
      limit: 20,
      windowMs: 60_000,
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
    };
  }

  if (pathname.startsWith("/assess/join/")) {
    return {
      key: `assess-join:${ip}`,
      limit: 10,
      windowMs: 60_000,
    };
  }

  // AI chat — streams from OpenRouter, maxDuration 300s. Each request spends
  // real money, so cap per-user aggressively.
  if (pathname === "/api/chat") {
    return {
      key: `chat:${userBucket(request, ip)}`,
      limit: 30,
      windowMs: 60_000,
    };
  }

  // Item generation — expensive AI job.
  if (pathname === "/api/generation/start") {
    return {
      key: `gen-start:${userBucket(request, ip)}`,
      limit: 10,
      windowMs: 60_000,
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

function applyRule(rule: RateLimitRule): RateLimitResult {
  const store = getStore();
  const now = Date.now();
  const cutoff = now - rule.windowMs;
  const timestamps = (store.get(rule.key) ?? []).filter(
    (timestamp) => timestamp > cutoff
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

export function checkRequestRateLimit(request: NextRequest) {
  const rule = resolveRule(request);
  if (!rule) {
    return null;
  }

  return applyRule(rule);
}
