import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "../../src/proxy";

// Mock Supabase middleware client — proxy tests don't exercise auth state
vi.mock("../../src/lib/supabase/middleware", () => ({
  createMiddlewareSupabaseClient: () => ({
    auth: { getUser: async () => ({ data: { user: null } }) },
  }),
}));

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
