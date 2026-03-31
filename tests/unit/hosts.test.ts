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
    expect(normalizeHost("  ADMIN.TALENTFIT.TEST  ")).toBe("admin.talentfit.test");
    expect(normalizeHost(null)).toBeNull();
    expect(normalizeUrl("https://example.com/path///?hello=world#section")).toBe(
      "https://example.com/path"
    );
    expect(normalizeUrl("not-a-url")).toBeNull();
  });

  it("builds surface URLs and allowed origins from configured env values", () => {
    vi.stubEnv("ADMIN_APP_URL", "https://admin.talentfit.test/");
    vi.stubEnv("ASSESS_APP_URL", "https://assess.talentfit.test/runtime/");
    vi.stubEnv(
      "SERVER_ACTION_ALLOWED_ORIGINS",
      "admin.talentfit.test,*.preview.talentfit.test"
    );

    expect(getConfiguredSurfaceUrl("admin")).toBe("https://admin.talentfit.test");
    expect(buildSurfaceUrl("assess", "/section/intro", "foo=bar")?.toString()).toBe(
      "https://assess.talentfit.test/section/intro?foo=bar"
    );
    expect(getSurfaceForHost("ASSESS.TALENTFIT.TEST")).toBe("assess");
    expect(getAllowedOriginPatterns()).toEqual([
      "assess.talentfit.test",
      "admin.talentfit.test",
      "*.preview.talentfit.test",
    ]);
  });

  it("infers surfaces from hosts, local routes, and local development hosts", () => {
    expect(inferSurfaceFromRequest({ host: "partner.talentfit.test" })).toBe("admin");
    expect(inferSurfaceFromRequest({ pathname: "/partner/campaigns" })).toBe("partner");
    expect(inferSurfaceFromRequest({ pathname: "/client/reports" })).toBe("client");
    expect(inferSurfaceFromRequest({ pathname: "/assess/token" })).toBe("assess");
    expect(inferSurfaceFromRequest({ pathname: "/dashboard" })).toBe("admin");

    expect(isLocalDevelopmentHost("localhost:3002")).toBe(true);
    expect(isLocalDevelopmentHost("127.0.0.1:3002")).toBe(true);
    expect(isLocalDevelopmentHost("talentfit.test")).toBe(false);

    expect(getRoutePrefixForSurface("admin", true)).toBe("");
    expect(getRoutePrefixForSurface("partner", true)).toBe("/partner");
    expect(getRoutePrefixForSurface("assess", false)).toBe("");
  });
});
