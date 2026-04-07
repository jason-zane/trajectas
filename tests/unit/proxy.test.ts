import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "../../proxy";

function createRequest(url: string, headers?: Record<string, string>) {
  const parsed = new URL(url);
  return new NextRequest(url, {
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

  it("keeps the public apex on the public surface", () => {
    const response = proxy(createRequest("https://trajectas.test/"));

    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-trajectas-surface")).toBe("public");
  });

  it("redirects admin routes from the public host to the admin host", () => {
    const response = proxy(createRequest("https://trajectas.test/dashboard"));

    expect(response.headers.get("location")).toBe(
      "https://admin.trajectas.test/dashboard"
    );
    expect(response.headers.get("x-trajectas-surface")).toBe("admin");
  });

  it("redirects the admin host root to the admin dashboard", () => {
    const response = proxy(createRequest("https://admin.trajectas.test/"));

    expect(response.headers.get("location")).toBe(
      "https://admin.trajectas.test/dashboard"
    );
    expect(response.headers.get("x-trajectas-surface")).toBe("admin");
  });
});
