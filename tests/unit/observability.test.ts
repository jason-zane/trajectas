import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { sendHtmlEmail } = vi.hoisted(() => ({ sendHtmlEmail: vi.fn() }));
vi.mock("@/lib/email/provider", () => ({ sendHtmlEmail }));

import { makeFingerprint } from "@/lib/observability/report-error";
import { sendOpsAlert } from "@/lib/observability/ops-alert";

describe("makeFingerprint", () => {
  it("combines source and message", () => {
    expect(makeFingerprint("reports.runner", "boom")).toBe("reports.runner:boom");
  });

  it("collapses UUIDs and numbers so the same failure groups together", () => {
    const a = makeFingerprint(
      "reports.runner",
      "snapshot 550e8400-e29b-41d4-a716-446655440000 failed after 3 retries",
    );
    const b = makeFingerprint(
      "reports.runner",
      "snapshot 6ba7b810-9dad-11d1-80b4-00c04fd430c8 failed after 7 retries",
    );
    expect(a).toBe(b);
    expect(a).toBe("reports.runner:snapshot <id> failed after <n> retries");
  });

  it("truncates very long messages", () => {
    const long = "x".repeat(500);
    expect(makeFingerprint("s", long).length).toBeLessThanOrEqual("s:".length + 200);
  });
});

describe("sendOpsAlert", () => {
  beforeEach(() => {
    sendHtmlEmail.mockReset();
    sendHtmlEmail.mockResolvedValue({ id: "email-1" });
    process.env.RESEND_API_KEY = "test-key";
    process.env.OPS_ALERT_EMAIL = "ops@example.com";
  });
  afterEach(() => {
    delete process.env.OPS_ALERT_EMAIL;
    delete process.env.RESEND_API_KEY;
  });

  it("is a no-op when OPS_ALERT_EMAIL is unset", async () => {
    delete process.env.OPS_ALERT_EMAIL;
    await sendOpsAlert({ subject: "x", body: "y", fingerprint: "fp-noop" });
    expect(sendHtmlEmail).not.toHaveBeenCalled();
  });

  it("is a no-op when the Resend key is unset", async () => {
    delete process.env.RESEND_API_KEY;
    await sendOpsAlert({ subject: "x", body: "y", fingerprint: "fp-nokey" });
    expect(sendHtmlEmail).not.toHaveBeenCalled();
  });

  it("emails ops when configured", async () => {
    await sendOpsAlert({ subject: "report failed", body: "stack", fingerprint: "fp-send" });
    expect(sendHtmlEmail).toHaveBeenCalledTimes(1);
    const arg = sendHtmlEmail.mock.calls[0][0];
    expect(arg.to).toBe("ops@example.com");
    expect(arg.subject).toContain("report failed");
    expect(arg.text).toBe("stack");
  });

  it("throttles repeat alerts for the same fingerprint", async () => {
    await sendOpsAlert({ subject: "a", body: "b", fingerprint: "fp-throttle" });
    await sendOpsAlert({ subject: "a", body: "b", fingerprint: "fp-throttle" });
    expect(sendHtmlEmail).toHaveBeenCalledTimes(1);
  });

  it("returns false (and does not throw) when the email send fails", async () => {
    sendHtmlEmail.mockRejectedValueOnce(new Error("resend down"));
    await expect(
      sendOpsAlert({ subject: "a", body: "b", fingerprint: "fp-throw" }),
    ).resolves.toBe(false);
  });

  it("returns false when Resend resolves with an error object", async () => {
    sendHtmlEmail.mockResolvedValueOnce({ data: null, error: { message: "bad" } });
    await expect(
      sendOpsAlert({ subject: "a", body: "b", fingerprint: "fp-resend-err" }),
    ).resolves.toBe(false);
  });

  it("returns true when the email is accepted", async () => {
    await expect(
      sendOpsAlert({ subject: "a", body: "b", fingerprint: "fp-ok" }),
    ).resolves.toBe(true);
  });
});
