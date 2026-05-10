import { beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { checkRequestRateLimit } from "@/lib/security/rate-limit";

function createRequest(url: string, init?: ConstructorParameters<typeof NextRequest>[1]) {
  return new NextRequest(url, init);
}

describe("request rate limiting", () => {
  beforeEach(() => {
    const globalStore = globalThis as typeof globalThis & {
      __trajectasRateLimitStore?: Map<string, number[]>;
    };

    globalStore.__trajectasRateLimitStore?.clear();
  });

  it("blocks repeated login attempts from the same IP", async () => {
    const request = createRequest("https://trajectas.test/login", {
      method: "POST",
      headers: {
        "x-forwarded-for": "203.0.113.10",
      },
    });

    let result = null;
    for (let attempt = 0; attempt < 11; attempt += 1) {
      result = await checkRequestRateLimit(request);
    }

    expect(result).toMatchObject({
      allowed: false,
      limit: 10,
      remaining: 0,
    });
    expect(result?.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("keys server actions by the authenticated session cookies", async () => {
    const request = createRequest("https://trajectas.test/client", {
      method: "POST",
      headers: {
        "next-action": "action-id",
        cookie:
          "sb-trajectas-auth-token=access-token; sb-refresh-token=refresh-token",
      },
    });

    let lastResult = null;
    for (let attempt = 0; attempt < 60; attempt += 1) {
      lastResult = await checkRequestRateLimit(request);
    }

    expect(lastResult).toMatchObject({
      allowed: true,
      limit: 60,
      remaining: 0,
    });

    const blocked = await checkRequestRateLimit(request);
    expect(blocked).toMatchObject({
      allowed: false,
      limit: 60,
      remaining: 0,
    });
  });
});
