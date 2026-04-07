import { describe, expect, it } from "vitest";
import { buildMagicLinkRedirectUrl } from "@/lib/auth/magic-link";

describe("magic link redirects", () => {
  it("preserves callback query params on the current origin", () => {
    expect(
      buildMagicLinkRedirectUrl({
        origin: "https://trajectas.com",
        redirectPath: "/auth/callback?next=%2Fclient%2Fdashboard",
        publicAppUrl: "https://trajectas.com",
        adminAppUrl: "https://admin.trajectas.com",
      })
    ).toBe("https://trajectas.com/auth/callback?next=%2Fclient%2Fdashboard");
  });

  it("falls back to the public app url when request headers are unavailable", () => {
    expect(
      buildMagicLinkRedirectUrl({
        redirectPath: "/auth/callback?invite=abc123&next=%2Fpartner",
        publicAppUrl: "https://trajectas.com",
        adminAppUrl: "https://admin.trajectas.com",
      })
    ).toBe("https://trajectas.com/auth/callback?invite=abc123&next=%2Fpartner");
  });

  it("ignores invalid headers and falls back safely", () => {
    expect(
      buildMagicLinkRedirectUrl({
        origin: "not-a-url",
        referer: "also-not-a-url",
        redirectPath: "/auth/callback",
        adminAppUrl: "https://admin.trajectas.com",
      })
    ).toBe("https://admin.trajectas.com/auth/callback");
  });
});
