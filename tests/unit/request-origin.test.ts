import { describe, expect, it } from "vitest";
import {
  hasCredentialedApiAuth,
  hasSameSiteFetchMetadata,
  hasStandardWebhookSignature,
  hostMatchesPattern,
  isAllowedMutationOrigin,
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

    expect(isAllowedOriginHost(null, allowed)).toBe(false);
    expect(isAllowedOriginHost("https://admin.trajectas.test", allowed)).toBe(true);
    expect(isAllowedOriginHost("https://foo.preview.trajectas.test", allowed)).toBe(true);
    expect(isAllowedOriginHost("notaurl", allowed)).toBe(false);
    expect(isAllowedOriginHost("https://other.trajectas.test", allowed)).toBe(false);
  });

  it("allows mutation requests from approved origins or same-site fetch metadata", () => {
    const allowed = ["admin.trajectas.test"];

    expect(
      isAllowedMutationOrigin(
        new Headers({ origin: "https://admin.trajectas.test" }),
        allowed
      )
    ).toBe(true);
    expect(
      isAllowedMutationOrigin(
        new Headers({ "sec-fetch-site": "same-origin" }),
        allowed
      )
    ).toBe(true);
    expect(isAllowedMutationOrigin(new Headers(), allowed)).toBe(false);
    expect(
      isAllowedMutationOrigin(
        new Headers({ "sec-fetch-site": "cross-site" }),
        allowed
      )
    ).toBe(false);
  });

  it("detects deliberate non-cookie API authentication signals", () => {
    expect(hasCredentialedApiAuth(new Headers({ "x-internal-key": "key" }))).toBe(true);
    expect(hasCredentialedApiAuth(new Headers({ authorization: "Bearer token" }))).toBe(true);
    expect(hasCredentialedApiAuth(new Headers({ authorization: "Basic abc" }))).toBe(false);

    expect(
      hasStandardWebhookSignature(
        new Headers({
          "webhook-id": "msg_1",
          "webhook-timestamp": "123",
          "webhook-signature": "v1,sig",
        })
      )
    ).toBe(true);
    expect(hasStandardWebhookSignature(new Headers({ "webhook-id": "msg_1" }))).toBe(false);

    expect(hasSameSiteFetchMetadata(new Headers({ "sec-fetch-site": "same-site" }))).toBe(true);
    expect(hasSameSiteFetchMetadata(new Headers({ "sec-fetch-site": "cross-site" }))).toBe(false);
  });
});
