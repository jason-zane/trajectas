import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildSurfaceUrl,
  getAllowedOriginPatterns,
  getConfiguredSurfaceUrl,
  getSurfaceForHost,
  getRoutePrefixForSurface,
  inferSurfaceFromRequest,
  isLocalDevelopmentHost,
  normalizeHost,
  normalizeUrl,
} from "@/lib/hosts";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("hosts", () => {
  it("normalizes host and url inputs", () => {
    expect(normalizeHost("  ADMIN.TRAJECTAS.TEST  ")).toBe("admin.trajectas.test");
    expect(normalizeHost(null)).toBeNull();
    expect(normalizeUrl("https://example.com/path///?hello=world#section")).toBe(
      "https://example.com/path"
    );
    expect(normalizeUrl("not-a-url")).toBeNull();
  });

  it("builds surface URLs and allowed origins from configured env values", () => {
    vi.stubEnv("PUBLIC_APP_URL", "https://trajectas.test/");
    vi.stubEnv("ADMIN_APP_URL", "https://admin.trajectas.test/");
    vi.stubEnv("ASSESS_APP_URL", "https://assess.trajectas.test/runtime/");
    vi.stubEnv(
      "SERVER_ACTION_ALLOWED_ORIGINS",
      "admin.trajectas.test,*.preview.trajectas.test"
    );

    expect(getConfiguredSurfaceUrl("public")).toBe("https://trajectas.test");
    expect(getConfiguredSurfaceUrl("admin")).toBe("https://admin.trajectas.test");
    expect(buildSurfaceUrl("assess", "/section/intro", "foo=bar")?.toString()).toBe(
      "https://assess.trajectas.test/section/intro?foo=bar"
    );
    expect(getSurfaceForHost("ASSESS.TRAJECTAS.TEST")).toBe("assess");
    expect(getAllowedOriginPatterns()).toEqual([
      "trajectas.test",
      "assess.trajectas.test",
      "admin.trajectas.test",
      "*.preview.trajectas.test",
    ]);
  });

  it("infers surfaces from hosts, local routes, and local development hosts", () => {
    vi.stubEnv("PUBLIC_APP_URL", "https://trajectas.test");
    vi.stubEnv("ADMIN_APP_URL", "https://admin.trajectas.test");

    expect(inferSurfaceFromRequest({ host: "trajectas.test" })).toBe("public");
    expect(inferSurfaceFromRequest({ host: "partner.trajectas.test" })).toBe("public");
    expect(inferSurfaceFromRequest({ pathname: "/partner/campaigns" })).toBe("partner");
    expect(inferSurfaceFromRequest({ pathname: "/client/reports" })).toBe("client");
    expect(inferSurfaceFromRequest({ pathname: "/assess/token" })).toBe("assess");
    expect(inferSurfaceFromRequest({ pathname: "/dashboard" })).toBe("public");
    expect(inferSurfaceFromRequest({ host: "localhost:3002", pathname: "/" })).toBe(
      "admin"
    );
    expect(
      inferSurfaceFromRequest({ host: "localhost:3002", pathname: "/dashboard" })
    ).toBe("admin");

    expect(isLocalDevelopmentHost("localhost:3002")).toBe(true);
    expect(isLocalDevelopmentHost("127.0.0.1:3002")).toBe(true);
    expect(isLocalDevelopmentHost("trajectas.test")).toBe(false);

    expect(getRoutePrefixForSurface("admin", true)).toBe("");
    expect(getRoutePrefixForSurface("partner", true)).toBe("/partner");
    expect(getRoutePrefixForSurface("assess", false)).toBe("");
  });
});
