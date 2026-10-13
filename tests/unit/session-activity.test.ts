import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  encodeLastActivity,
  decodeLastActivity,
  isSessionExpired,
  INACTIVITY_TIMEOUT_SECONDS,
  COOKIE_NAME,
} from "@/lib/auth/session-activity";

import {
  getSessionTimeouts,
  WARNING_THRESHOLD_SECONDS,
  PLATFORM_ADMIN_INACTIVITY_TIMEOUT_SECONDS,
  PLATFORM_ADMIN_WARNING_THRESHOLD_SECONDS,
} from "@/lib/auth/session-activity-constants";

const TEST_SECRET = "test-secret-at-least-32-chars-long-ok";

beforeEach(() => {
  vi.stubEnv("TRAJECTAS_CONTEXT_SECRET", TEST_SECRET);
});

describe("encodeLastActivity / decodeLastActivity", () => {
  it("round-trips an epoch timestamp", () => {
    const now = Math.floor(Date.now() / 1000);
    const encoded = encodeLastActivity(now);
    expect(typeof encoded).toBe("string");
    expect(encoded).toContain(".");
    expect(decodeLastActivity(encoded)).toBe(now);
  });

  it("returns null for null/undefined", () => {
    expect(decodeLastActivity(null)).toBeNull();
    expect(decodeLastActivity(undefined)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(decodeLastActivity("")).toBeNull();
  });

  it("returns null when signature is missing", () => {
    expect(decodeLastActivity("onlypayload")).toBeNull();
  });

  it("rejects a tampered timestamp", () => {
    const now = Math.floor(Date.now() / 1000);
    const encoded = encodeLastActivity(now);
    const [payload, sig] = encoded.split(".");
    // Change the last char of payload to corrupt it
    const tampered = payload.slice(0, -1) + (payload.slice(-1) === "A" ? "B" : "A") + "." + sig;
    expect(decodeLastActivity(tampered)).toBeNull();
  });

  it("rejects a tampered signature", () => {
    const now = Math.floor(Date.now() / 1000);
    const encoded = encodeLastActivity(now);
    const [payload] = encoded.split(".");
    const tampered = payload + ".invalidsignature";
    expect(decodeLastActivity(tampered)).toBeNull();
  });
});

describe("isSessionExpired", () => {
  it("returns false for a very recent timestamp", () => {
    const now = Math.floor(Date.now() / 1000);
    expect(isSessionExpired(now)).toBe(false);
  });

  it("returns false just under the timeout", () => {
    const now = Math.floor(Date.now() / 1000);
    expect(isSessionExpired(now - INACTIVITY_TIMEOUT_SECONDS + 1)).toBe(false);
  });

  it("returns true exactly at the timeout", () => {
    const now = Math.floor(Date.now() / 1000);
    expect(isSessionExpired(now - INACTIVITY_TIMEOUT_SECONDS)).toBe(true);
  });

  it("returns true for a timestamp >90 min ago", () => {
    const now = Math.floor(Date.now() / 1000);
    expect(isSessionExpired(now - 5401)).toBe(true);
  });
});

describe("constants", () => {
  it("INACTIVITY_TIMEOUT_SECONDS is 5400", () => {
    expect(INACTIVITY_TIMEOUT_SECONDS).toBe(5400);
  });

  it("COOKIE_NAME is tf_last_activity", () => {
    expect(COOKIE_NAME).toBe("tf_last_activity");
  });
});


describe("role-based session limits", () => {
  it.each(["org_admin", "partner_admin", "consultant", "participant"])(
    "gives %s 90 minutes with a warning at 85",
    (role) => {
      expect(getSessionTimeouts(role)).toEqual({
        inactivityTimeoutSeconds: 5400,
        warningThresholdSeconds: 5100,
      });
    }
  );

  it.each(["platform_admin", null, undefined])(
    "keeps the shorter policy for role %s",
    (role) => {
      expect(getSessionTimeouts(role)).toEqual({
        inactivityTimeoutSeconds: 1800,
        warningThresholdSeconds: 1500,
      });
    }
  );

  it("keeps the warning five minutes before each timeout", () => {
    expect(INACTIVITY_TIMEOUT_SECONDS - WARNING_THRESHOLD_SECONDS).toBe(300);
    expect(PLATFORM_ADMIN_INACTIVITY_TIMEOUT_SECONDS - PLATFORM_ADMIN_WARNING_THRESHOLD_SECONDS).toBe(300);
  });

  it("expires platform admins exactly at 30 minutes", () => {
    const now = Math.floor(Date.now() / 1000);
    expect(isSessionExpired(now - 1799, PLATFORM_ADMIN_INACTIVITY_TIMEOUT_SECONDS)).toBe(false);
    expect(isSessionExpired(now - 1800, PLATFORM_ADMIN_INACTIVITY_TIMEOUT_SECONDS)).toBe(true);
    expect(isSessionExpired(now - 1800)).toBe(false);
  });
});
