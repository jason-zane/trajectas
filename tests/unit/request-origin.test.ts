import { describe, expect, it } from "vitest";
import {
  hostMatchesPattern,
  isAllowedOriginHost,
} from "@/lib/security/request-origin";

describe("request origin matching", () => {
  it("matches exact and wildcard hosts case-insensitively", () => {
    expect(hostMatchesPattern("preview.talentfit.test", "preview.talentfit.test")).toBe(
      true
    );
    expect(hostMatchesPattern("app.preview.talentfit.test", "*.preview.talentfit.test")).toBe(
      true
    );
    expect(hostMatchesPattern("evil.com", "*.preview.talentfit.test")).toBe(false);
  });

  it("accepts allowed origins and rejects invalid origin values", () => {
    const allowed = ["admin.talentfit.test", "*.preview.talentfit.test"];

    expect(isAllowedOriginHost(null, allowed)).toBe(true);
    expect(isAllowedOriginHost("https://admin.talentfit.test", allowed)).toBe(true);
    expect(isAllowedOriginHost("https://foo.preview.talentfit.test", allowed)).toBe(true);
    expect(isAllowedOriginHost("notaurl", allowed)).toBe(false);
    expect(isAllowedOriginHost("https://other.talentfit.test", allowed)).toBe(false);
  });
});
