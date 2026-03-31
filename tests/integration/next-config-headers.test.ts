import { describe, expect, it } from "vitest";
import { unstable_getResponseFromNextConfig } from "next/experimental/testing/server";
import nextConfig from "../../next.config";

describe("next config integration", () => {
  it("applies security headers through Next's config testing utilities", async () => {
    const response = await unstable_getResponseFromNextConfig({
      url: "https://talentfit.test/surface-coming-soon",
      nextConfig,
    });

    expect(response.headers.get("referrer-policy")).toBe(
      "strict-origin-when-cross-origin"
    );
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("x-dns-prefetch-control")).toBe("off");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(response.headers.get("permissions-policy")).toContain("microphone=()");
  });
});
