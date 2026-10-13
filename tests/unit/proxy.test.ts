import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readdirSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { NextRequest } from "next/server";
import { proxy } from "../../src/proxy";
import { COOKIE_NAME, encodeLastActivity, decodeLastActivity } from "@/lib/auth/session-activity";
import robots from "../../src/app/robots";
import sitemap from "../../src/app/sitemap";
import { MARKETING_PATHS } from "../../src/lib/seo/marketing-routes";

const MARKETING_GROUP = join(
  resolve(dirname(fileURLToPath(import.meta.url)), "..", ".."),
  "src",
  "app",
  "(marketing)"
);

// Mock Supabase middleware client
const mockProfileLookup = vi.fn();
const mockProfileEq = vi.fn(() => ({ maybeSingle: mockProfileLookup }));
const mockProfileFrom = vi.fn(() => ({
  select: vi.fn(() => ({
    eq: mockProfileEq,
  })),
}));

let mockSupabaseClient: {
  from: typeof mockProfileFrom;
  auth: { getClaims: () => Promise<{ data: { claims: { sub: string } } | null; error: null }> };
};

vi.mock("../../src/lib/supabase/middleware", () => ({
  createMiddlewareSupabaseClient: () => mockSupabaseClient,
}));

// Default to unauthenticated; tests can override
beforeEach(() => {
  mockProfileLookup.mockResolvedValue({ data: { role: "consultant" }, error: null });
  mockSupabaseClient = {
    from: mockProfileFrom,
    auth: { getClaims: async () => ({ data: null, error: null }) },
  };
});

function createRequest(
  url: string,
  headers?: Record<string, string>,
  method = "GET"
) {
  const parsed = new URL(url);
  return new NextRequest(url, {
    method,
    headers: {
      host: parsed.host,
      ...headers,
    },
  });
}

describe("proxy surface routing", () => {
  beforeEach(() => {
    vi.stubEnv("PUBLIC_APP_URL", "https://trajectas.test");
    vi.stubEnv("ADMIN_APP_URL", "https://admin.trajectas.test");
    vi.stubEnv("ASSESS_APP_URL", "https://assess.trajectas.test");
    vi.stubEnv("PARTNER_APP_URL", "https://partner.trajectas.test");
    vi.stubEnv("CLIENT_APP_URL", "https://client.trajectas.test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("keeps the public apex on the public surface", async () => {
    const response = await proxy(createRequest("https://trajectas.test/"));

    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-trajectas-surface")).toBe("public");
  });

  it("redirects admin routes from the public host to the admin host", async () => {
    const response = await proxy(createRequest("https://trajectas.test/dashboard"));

    expect(response.headers.get("location")).toBe(
      "https://admin.trajectas.test/dashboard"
    );
    expect(response.headers.get("x-trajectas-surface")).toBe("admin");
  });

  it("redirects the admin host root to the admin dashboard", async () => {
    const response = await proxy(createRequest("https://admin.trajectas.test/"));

    expect(response.headers.get("location")).toBe(
      "https://admin.trajectas.test/dashboard"
    );
    expect(response.headers.get("x-trajectas-surface")).toBe("admin");
  });

  it("keeps shared auth routes accessible on the partner host", async () => {
    const response = await proxy(
      createRequest("https://partner.trajectas.test/login?next=%2Fpartner")
    );

    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
    expect(response.headers.get("x-trajectas-surface")).toBe("partner");
  });

  it("rejects cookie-authenticated API mutations without origin or fetch metadata", async () => {
    const response = await proxy(
      createRequest("https://admin.trajectas.test/api/generation/start", undefined, "POST")
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Origin not allowed for protected mutation route.",
    });
  });

  it("allows same-site API mutations based on fetch metadata", async () => {
    const response = await proxy(
      createRequest(
        "https://admin.trajectas.test/api/generation/start",
        { "sec-fetch-site": "same-origin" },
        "POST"
      )
    );

    expect(response.status).not.toBe(403);
    expect(response.headers.get("x-trajectas-surface")).toBe("admin");
  });

  it("allows deliberate non-cookie API auth and signed webhook routes without Origin", async () => {
    const internalResponse = await proxy(
      createRequest(
        "https://admin.trajectas.test/api/reports/generate",
        { "x-internal-key": "test" },
        "POST"
      )
    );
    expect(internalResponse.status).not.toBe(403);

    const webhookResponse = await proxy(
      createRequest(
        "https://admin.trajectas.test/api/auth/send-email",
        {
          "webhook-id": "msg_1",
          "webhook-timestamp": "123",
          "webhook-signature": "v1,sig",
        },
        "POST"
      )
    );
    expect(webhookResponse.status).not.toBe(403);
  });
});

describe("proxy public-host marketing routes", () => {
  beforeEach(() => {
    vi.stubEnv("PUBLIC_APP_URL", "https://trajectas.test");
    vi.stubEnv("ADMIN_APP_URL", "https://admin.trajectas.test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // Every non-allowlisted page path on the public host is redirected to the
  // admin host, which is how these pages were once served from admin.* with a
  // noindex header. Local dev skips that redirect, so only a test catches it.
  it.each([
    "/psychometric-assessment",
    "/capability-assessment",
    "/performance-and-outcomes?utm_source=linkedin",
    "/classic",
  ])("serves %s on the public host", async (path) => {
    const response = await proxy(createRequest(`https://trajectas.test${path}`));

    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-trajectas-surface")).toBe("public");
    expect(response.headers.get("X-Robots-Tag")).toBeNull();
    expect(response.headers.get("Content-Security-Policy-Report-Only")).toContain(
      "frame-src https://app.cal.com https://cal.com"
    );
  });

  it("still redirects paths beneath a marketing page to the admin host", async () => {
    const response = await proxy(
      createRequest("https://trajectas.test/capability-assessment/admin")
    );

    expect(response.headers.get("location")).toBe(
      "https://admin.trajectas.test/capability-assessment/admin"
    );
  });

  it("serves every sitemap URL on the public host", async () => {
    const entries = sitemap();
    expect(entries.length).toBeGreaterThan(0);

    for (const { url } of entries) {
      expect(new URL(url).origin, url).toBe("https://trajectas.test");
      const response = await proxy(createRequest(url));
      expect(response.headers.get("location"), url).toBeNull();
      expect(response.headers.get("x-trajectas-surface"), url).toBe("public");
    }
  });

  it("keeps the noindex /classic page out of the sitemap", () => {
    const paths = sitemap().map(({ url }) => new URL(url).pathname);

    expect(paths).not.toContain("/classic");
    expect(MARKETING_PATHS.has("/classic")).toBe(true);
  });

  it("does not disallow any sitemap URL in robots.txt", () => {
    const disallow = [robots().rules]
      .flat()
      .flatMap((rule) => [rule.disallow ?? []].flat());

    for (const { url } of sitemap()) {
      const { pathname } = new URL(url);
      expect(
        disallow.filter((prefix) => pathname.startsWith(prefix)),
        pathname
      ).toEqual([]);
    }
  });

  it("allowlists every page in the (marketing) route group", () => {
    const pagePaths = readdirSync(MARKETING_GROUP, { recursive: true })
      .map(String)
      .filter((file) => file === "page.tsx" || file.endsWith(`${sep}page.tsx`))
      .map((file) => {
        const segments = dirname(file)
          .split(sep)
          .filter((segment) => segment !== "." && !/^\(.*\)$/.test(segment));
        return `/${segments.join("/")}`;
      })
      .sort();

    expect(pagePaths).toEqual([...MARKETING_PATHS].sort());
  });
});

describe("proxy authenticated paths", () => {
  beforeEach(() => {
    vi.stubEnv("PUBLIC_APP_URL", "https://trajectas.test");
    vi.stubEnv("ADMIN_APP_URL", "https://admin.trajectas.test");
    vi.stubEnv("ASSESS_APP_URL", "https://assess.trajectas.test");
    vi.stubEnv("PARTNER_APP_URL", "https://partner.trajectas.test");
    vi.stubEnv("CLIENT_APP_URL", "https://client.trajectas.test");
    // Required for session activity cookie signing in authenticated tests
    vi.stubEnv("TRAJECTAS_CONTEXT_SECRET", "test-signing-secret-32-bytes-here");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allows authenticated user on admin dashboard route", async () => {
    mockSupabaseClient.auth.getClaims = async () => ({
      data: { claims: { sub: "test-user-id" } },
      error: null,
    });

    const response = await proxy(
      createRequest("https://admin.trajectas.test/dashboard")
    );

    expect(response.status).not.toBe(307); // Should not redirect
    expect(response.headers.get("x-trajectas-surface")).toBe("admin");
  });

  it("allows authenticated user on partner surface", async () => {
    mockSupabaseClient.auth.getClaims = async () => ({
      data: { claims: { sub: "test-user-id" } },
      error: null,
    });

    const response = await proxy(
      createRequest("https://partner.trajectas.test/partner/dashboard")
    );

    expect(response.headers.get("x-trajectas-surface")).toBe("partner");
  });

  it("allows authenticated user on client surface", async () => {
    mockSupabaseClient.auth.getClaims = async () => ({
      data: { claims: { sub: "test-user-id" } },
      error: null,
    });

    const response = await proxy(
      createRequest("https://client.trajectas.test/client/dashboard")
    );

    expect(response.headers.get("x-trajectas-surface")).toBe("client");
  });

  it("allows cross-surface redirect with authenticated user", async () => {
    mockSupabaseClient.auth.getClaims = async () => ({
      data: { claims: { sub: "test-user-id" } },
      error: null,
    });

    // Public surface user trying to access dashboard (admin surface)
    const response = await proxy(
      createRequest("https://trajectas.test/dashboard")
    );

    expect(response.status).toBe(307); // Redirect expected
    expect(response.headers.get("location")).toBe(
      "https://admin.trajectas.test/dashboard"
    );
    expect(response.headers.get("x-trajectas-surface")).toBe("admin");
  });
});

describe("proxy CSP header modes", () => {
  beforeEach(() => {
    vi.stubEnv("PUBLIC_APP_URL", "https://trajectas.test");
    vi.stubEnv("ADMIN_APP_URL", "https://admin.trajectas.test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses Content-Security-Policy (enforcing) by default on dynamic surfaces", async () => {
    const response = await proxy(createRequest("https://admin.trajectas.test/dashboard"));

    expect(response.headers.has("Content-Security-Policy")).toBe(true);
    expect(response.headers.has("Content-Security-Policy-Report-Only")).toBe(false);
    const cspValue = response.headers.get("Content-Security-Policy");
    expect(cspValue).toContain("script-src");
    expect(cspValue).toContain("strict-dynamic");
  });

  it("stays report-only by default on the static public surface", async () => {
    // Marketing pages are statically prerendered: their script tags carry no
    // per-request nonce, so nonce+strict-dynamic enforcement would block all
    // JS (verified on preview). Public enforces only with CSP_ENFORCE=1.
    const response = await proxy(createRequest("https://trajectas.test/"));

    expect(response.headers.has("Content-Security-Policy-Report-Only")).toBe(true);
    expect(response.headers.has("Content-Security-Policy")).toBe(false);
  });

  it("CSP_ENFORCE=1 forces enforcement on the public surface too", async () => {
    vi.stubEnv("CSP_ENFORCE", "1");

    const response = await proxy(createRequest("https://trajectas.test/"));

    expect(response.headers.has("Content-Security-Policy")).toBe(true);
    expect(response.headers.has("Content-Security-Policy-Report-Only")).toBe(false);
  });

  it("uses Content-Security-Policy-Report-Only when CSP_REPORT_ONLY=1", async () => {
    vi.stubEnv("CSP_REPORT_ONLY", "1");

    const response = await proxy(createRequest("https://admin.trajectas.test/dashboard"));

    expect(response.headers.has("Content-Security-Policy-Report-Only")).toBe(true);
    expect(response.headers.has("Content-Security-Policy")).toBe(false);
    const cspValue = response.headers.get("Content-Security-Policy-Report-Only");
    expect(cspValue).toContain("script-src");
  });

  it("uses Content-Security-Policy when CSP_ENFORCE=1 (backwards compat)", async () => {
    vi.stubEnv("CSP_ENFORCE", "1");

    const response = await proxy(createRequest("https://admin.trajectas.test/dashboard"));

    expect(response.headers.has("Content-Security-Policy")).toBe(true);
    expect(response.headers.has("Content-Security-Policy-Report-Only")).toBe(false);
  });

  it("prefers CSP_ENFORCE=1 over CSP_REPORT_ONLY=1", async () => {
    vi.stubEnv("CSP_ENFORCE", "1");
    vi.stubEnv("CSP_REPORT_ONLY", "1");

    const response = await proxy(createRequest("https://admin.trajectas.test/dashboard"));

    expect(response.headers.has("Content-Security-Policy")).toBe(true);
    expect(response.headers.has("Content-Security-Policy-Report-Only")).toBe(false);
  });

  it("includes nonce in script-src directive", async () => {
    const response = await proxy(createRequest("https://admin.trajectas.test/dashboard"));

    const cspValue = response.headers.get("Content-Security-Policy");
    expect(cspValue).toMatch(/script-src.*'nonce-/);
  });

  it("includes strict-dynamic in script-src on enforcing CSP", async () => {
    const response = await proxy(createRequest("https://admin.trajectas.test/dashboard"));

    const cspValue = response.headers.get("Content-Security-Policy");
    expect(cspValue).toContain("'strict-dynamic'");
  });

  it("forwards CSP header in request headers for SSR nonce attachment", async () => {
    const response = await proxy(createRequest("https://admin.trajectas.test/dashboard"));

    // The response should have been created with CSP forwarded to SSR
    // (we can't directly inspect request headers in the proxy function,
    // but we can verify the response carries a CSP header from the proxy)
    expect(response.headers.has("Content-Security-Policy")).toBe(true);
  });

  it("applies CSP per-surface correctly (admin surface)", async () => {
    const response = await proxy(createRequest("https://admin.trajectas.test/dashboard"));
    const cspValue = response.headers.get("Content-Security-Policy");

    // Admin surface should have frame-src 'none' and specific connect-src
    expect(cspValue).toContain("frame-src 'none'");
    expect(cspValue).toContain("connect-src");
  });

  it("applies CSP per-surface correctly (public surface)", async () => {
    vi.stubEnv("PUBLIC_APP_URL", "https://trajectas.test");
    const response = await proxy(createRequest("https://trajectas.test/"));
    // Public is report-only by default (static pages carry no nonce).
    const cspValue = response.headers.get("Content-Security-Policy-Report-Only");

    // Public surface should allow Cal.com iframes
    expect(cspValue).toContain("frame-src https://app.cal.com https://cal.com");
  });

  it("maintains CSP in cross-surface redirects", async () => {
    // Redirect from public to admin surface
    const response = await proxy(createRequest("https://trajectas.test/dashboard"));

    expect(response.status).toBe(307);
    expect(response.headers.has("Content-Security-Policy")).toBe(true);
    const cspValue = response.headers.get("Content-Security-Policy");
    expect(cspValue).toContain("script-src");
  });
});

describe("proxy role-based inactivity", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-13T00:00:00Z"));
    vi.stubEnv("ADMIN_APP_URL", "https://admin.trajectas.test");
    vi.stubEnv("PARTNER_APP_URL", "https://partner.trajectas.test");
    vi.stubEnv("CLIENT_APP_URL", "https://client.trajectas.test");
    vi.stubEnv("TRAJECTAS_CONTEXT_SECRET", "test-signing-secret-32-bytes-here");
    mockSupabaseClient.auth.getClaims = async () => ({
      data: { claims: { sub: "test-user-id" } }, error: null,
    });
  });

  afterEach(() => { vi.useRealTimers(); });

  function requestAfter(seconds: number, path = "https://client.trajectas.test/campaigns") {
    const request = createRequest(path);
    request.cookies.set(COOKIE_NAME, encodeLastActivity(Math.floor(Date.now() / 1000) - seconds));
    return request;
  }

  it("lets a regular user return after 60 minutes and refreshes activity", async () => {
    const response = await proxy(requestAfter(3600));
    expect(response.headers.get("location")).toBeNull();
    const refreshed = decodeLastActivity(response.cookies.get(COOKIE_NAME)?.value);
    expect(refreshed).toBeGreaterThanOrEqual(Math.floor(Date.now() / 1000) - 1);
    expect(mockProfileFrom).toHaveBeenCalledWith("profiles");
    expect(mockProfileEq).toHaveBeenCalledWith("id", "test-user-id");
  });

  it("reports the role lookup separately in Server-Timing", async () => {
    let elapsed = 0;
    vi.spyOn(performance, "now").mockImplementation(() => elapsed);
    mockProfileLookup.mockImplementation(async () => {
      elapsed += 125;
      return { data: { role: "consultant" }, error: null };
    });
    const response = await proxy(requestAfter(3600));
    expect(response.headers.get("Server-Timing")).toContain("auth_role;dur=125.0");
  });

  it("allows regular users just before 90 minutes", async () => {
    const response = await proxy(requestAfter(5399));
    expect(response.headers.get("location")).toBeNull();
  });

  it("expires regular users exactly at 90 minutes", async () => {
    const response = await proxy(requestAfter(5400));
    expect(response.headers.get("location")).toBe("https://client.trajectas.test/auth/expire");
  });

  it.each([
    "https://admin.trajectas.test/dashboard",
    "https://client.trajectas.test/campaigns",
    "https://partner.trajectas.test/clients",
  ])("expires platform admins at 30 minutes on %s", async (path) => {
    mockProfileLookup.mockResolvedValue({ data: { role: "platform_admin" }, error: null });
    const response = await proxy(requestAfter(1800, path));
    expect(response.headers.get("location")).toBe(new URL("/auth/expire", path).toString());
  });

  it.each(["platform_admin", "consultant"])("avoids extra role queries while %s is active", async () => {
    const response = await proxy(requestAfter(1799));
    expect(response.headers.get("location")).toBeNull();
    expect(mockProfileFrom).not.toHaveBeenCalled();
    expect(response.headers.get("Server-Timing")).not.toContain("auth_role");
  });

  it.each([
    { data: null, error: null },
    { data: null, error: { message: "Profile lookup failed" } },
    { data: { role: "consultant" }, error: { message: "Profile lookup failed" } },
  ])("uses 30 minutes when the account role cannot be verified (%j)", async (result) => {
    mockProfileLookup.mockResolvedValue(result);
    const response = await proxy(requestAfter(1800));
    expect(response.headers.get("location")).toBe("https://client.trajectas.test/auth/expire");
  });

  it("enforces the same policy on the keep-alive API", async () => {
    mockProfileLookup.mockResolvedValue({ data: { role: "platform_admin" }, error: null });
    const request = createRequest("https://client.trajectas.test/api/auth/activity", { "sec-fetch-site": "same-origin" }, "POST");
    request.cookies.set(COOKIE_NAME, encodeLastActivity(Math.floor(Date.now() / 1000) - 1800));
    const response = await proxy(request);
    expect(response.headers.get("location")).toBe("https://client.trajectas.test/auth/expire");
  });

  it("keeps assessment and authentication routes outside the staff inactivity check", async () => {
    for (const path of ["/assess/example", "/auth/callback", "/auth/expire", "/login"]) {
      const response = await proxy(requestAfter(7200, `https://client.trajectas.test${path}`));
      expect(response.headers.get("location")).not.toBe("https://client.trajectas.test/auth/expire");
    }
    expect(mockProfileFrom).not.toHaveBeenCalled();
  });
});
