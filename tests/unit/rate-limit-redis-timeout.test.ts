import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { redisEval, reportError } = vi.hoisted(() => ({
  redisEval: vi.fn(),
  reportError: vi.fn(),
}));

// Keep the real, locked Ratelimit implementation: only its Redis transport is
// replaced. This catches the SDK resolving a timeout with success:true.
vi.mock("@upstash/redis", () => ({
  Redis: class {
    evalsha = redisEval;
    eval = redisEval;
  },
}));
vi.mock("@/lib/observability/report-error", () => ({ reportError }));

describe("Redis rate-limit timeout policy", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-06T00:00:00Z"));
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.invalid");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "unit-test-only");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    redisEval.mockImplementation(() => new Promise(() => {}));
    reportError.mockResolvedValue(undefined);
    (globalThis as typeof globalThis & {
      __trajectasRateLimitStore?: Map<string, number[]>;
    }).__trajectasRateLimitStore?.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    ["/api/chat", "POST", 30],
    ["/api/reports/11111111-1111-4111-8111-111111111111/pdf", "GET", 20],
  ] as const)("denies %s when the actual SDK timeout resolves as success", async (path, method, limit) => {
    const { checkRequestRateLimit } = await import("@/lib/security/rate-limit");
    const pending = checkRequestRateLimit(new NextRequest(`https://trajectas.test${path}`, { method }));
    await vi.advanceTimersByTimeAsync(5000);
    await expect(pending).resolves.toEqual({ allowed: false, limit, remaining: 0, retryAfterSeconds: 60 });
    expect(redisEval).toHaveBeenCalledTimes(1);
    expect(reportError).toHaveBeenCalledWith(expect.objectContaining({ message: "Redis rate-limit check timed out" }),
      expect.objectContaining({ source: "rate-limit.redis_error", context: expect.objectContaining({ fail_closed: true }) }));
  });

  it("uses the existing bounded local login fallback on timeout", async () => {
    const { checkRequestRateLimit } = await import("@/lib/security/rate-limit");
    const request = new NextRequest("https://trajectas.test/login", {
      method: "POST", headers: { "x-forwarded-for": "203.0.113.2" },
    });
    const pending = Promise.all(Array.from({ length: 11 }, () => checkRequestRateLimit(request)));
    await vi.advanceTimersByTimeAsync(5000);
    const results = await pending;
    expect(results.filter(result => result?.allowed)).toHaveLength(10);
    expect(results[10]).toMatchObject({ allowed: false, limit: 10, remaining: 0 });
  });

  it("denies an explicitly fail-closed keyed operation on timeout", async () => {
    const { checkKeyedRateLimit } = await import("@/lib/security/rate-limit");
    const pending = checkKeyedRateLimit("expensive:actor", 3, 60_000, true);
    await vi.advanceTimersByTimeAsync(5000);
    await expect(pending).resolves.toEqual({ allowed: false, limit: 3, remaining: 0, retryAfterSeconds: 60 });
    expect(reportError).toHaveBeenCalledWith(expect.objectContaining({ message: "Redis rate-limit check timed out" }),
      expect.objectContaining({ source: "rate-limit.keyed.redis_error", context: { key_prefix: "expensive", fail_closed: true } }));
  });

  it("preserves independent 120/min participant fallback buckets on timeout", async () => {
    const { checkAssessApiTokenRateLimit } = await import("@/lib/security/rate-limit");
    const tokenA = "a".repeat(64), tokenB = "b".repeat(64);
    const pending = Promise.all([
      ...Array.from({ length: 121 }, () => checkAssessApiTokenRateLimit("save-batch", tokenA)),
      checkAssessApiTokenRateLimit("save-batch", tokenB),
    ]);
    await vi.advanceTimersByTimeAsync(5000);
    const results = await pending;
    expect(results.slice(0, 121).filter(result => result?.allowed)).toHaveLength(120);
    expect(results[120]).toMatchObject({ allowed: false, limit: 120, remaining: 0 });
    expect(results[121]).toMatchObject({ allowed: true, limit: 120, remaining: 119 });
    expect(JSON.stringify(reportError.mock.calls)).not.toContain(tokenA);
    expect(JSON.stringify(reportError.mock.calls)).not.toContain(tokenB);
  });

  it.each([true, false])("preserves a normal Redis result (allowed=%s)", async allowed => {
    redisEval.mockResolvedValue([allowed ? 2 : -1, 3]);
    const { checkKeyedRateLimit } = await import("@/lib/security/rate-limit");
    await expect(checkKeyedRateLimit("normal:actor", 3, 60_000, true)).resolves.toMatchObject({
      allowed, limit: 3, remaining: allowed ? 2 : 0, retryAfterSeconds: allowed ? 0 : 60,
    });
    expect(reportError).not.toHaveBeenCalled();
  });

  it("keeps fail-closed behavior for a rejected Redis operation", async () => {
    redisEval.mockRejectedValue(new Error("Redis unavailable"));
    const { checkRequestRateLimit } = await import("@/lib/security/rate-limit");
    await expect(checkRequestRateLimit(new NextRequest("https://trajectas.test/api/chat", { method: "POST" })))
      .resolves.toEqual({ allowed: false, limit: 30, remaining: 0, retryAfterSeconds: 60 });
  });
});
