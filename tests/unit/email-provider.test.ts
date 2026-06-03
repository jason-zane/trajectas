import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the Resend SDK so we control what `emails.send` resolves with. The SDK
// resolves with { data, error } and does NOT reject on API-level failures.
const mocks = vi.hoisted(() => ({ send: vi.fn() }));

vi.mock("resend", () => ({
  Resend: class {
    emails = { send: mocks.send };
  },
}));

import { sendHtmlEmail } from "@/lib/email/provider";

describe("sendHtmlEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RESEND_API_KEY = "test-key";
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  const base = {
    to: "invitee@example.com",
    subject: "Hi",
    html: "<p>Hi</p>",
    text: "Hi",
  };

  it("returns the data payload on success", async () => {
    mocks.send.mockResolvedValue({ data: { id: "email-1" }, error: null });

    await expect(sendHtmlEmail(base)).resolves.toEqual({ id: "email-1" });
  });

  it("throws when Resend returns an error instead of swallowing it", async () => {
    mocks.send.mockResolvedValue({
      data: null,
      error: { name: "validation_error", message: "The domain is not verified" },
    });

    await expect(sendHtmlEmail(base)).rejects.toThrow(/validation_error/);
    await expect(sendHtmlEmail(base)).rejects.toThrow(/domain is not verified/);
  });

  it("names all recipients in the thrown error", async () => {
    mocks.send.mockResolvedValue({
      data: null,
      error: { name: "rate_limit_exceeded", message: "Too many requests" },
    });

    await expect(
      sendHtmlEmail({ ...base, to: ["a@example.com", "b@example.com"] })
    ).rejects.toThrow(/a@example.com, b@example.com/);
  });
});
