import { describe, expect, it } from "vitest";
import {
  hostMatchesPattern,
  isAllowedOriginHost,
} from "@/lib/security/request-origin";

describe("request origin matching", () => {
  it("matches exact and wildcard hosts case-insensitively", () => {
    expect(hostMatchesPattern("preview.trajectas.test", "preview.trajectas.test")).toBe(
      true
    );
    expect(hostMatchesPattern("app.preview.trajectas.test", "*.preview.trajectas.test")).toBe(
      true
    );
    expect(hostMatchesPattern("evil.com", "*.preview.trajectas.test")).toBe(false);
  });

  it("accepts allowed origins and rejects invalid origin values", () => {
    const allowed = ["admin.trajectas.test", "*.preview.trajectas.test"];

    expect(isAllowedOriginHost(null, allowed)).toBe(true);
    expect(isAllowedOriginHost("https://admin.trajectas.test", allowed)).toBe(true);
    expect(isAllowedOriginHost("https://foo.preview.trajectas.test", allowed)).toBe(true);
    expect(isAllowedOriginHost("notaurl", allowed)).toBe(false);
    expect(isAllowedOriginHost("https://other.trajectas.test", allowed)).toBe(false);
  });
});
