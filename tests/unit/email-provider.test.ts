import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the Resend SDK so we control what `emails.send` resolves with. The SDK
// resolves with { data, error } and does NOT reject on API-level failures.
const mocks = vi.hoisted(() => ({ send: vi.fn() }));

vi.mock("resend", () => ({
  Resend: class {
    emails = { send: mocks.send };
  },
}));

import { sendHtmlEmail } from "@/lib/email/provider";
afterEach(() => vi.unstubAllEnvs());

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

  it("allows only the single-recipient staff OTP path in the dedicated Preview", async () => {
    vi.stubEnv('VERCEL_ENV', 'preview');
    vi.stubEnv('TRAJECTAS_PERSONALITY_PREVIEW_TARGET', 'bgrvqvtlhmfmvcytncgw');
    const log = vi.spyOn(console, 'info').mockImplementation(() => {});
    mocks.send.mockResolvedValue({ data: { id: 'synthetic-delivery' }, error: null });
    await expect(sendHtmlEmail({ ...base, purpose: 'staff_auth' })).resolves.toEqual({ id: 'synthetic-delivery' });
    expect(log).toHaveBeenCalledWith('[email] Preview staff sign-in email accepted', { providerMessageId: 'synthetic-delivery' });
    expect(mocks.send).toHaveBeenCalledWith(expect.not.objectContaining({ purpose: expect.anything() }));
    expect(JSON.stringify(log.mock.calls)).not.toContain(base.to);
    log.mockRestore();
  });

  it.each([
    {},
    { purpose: 'staff_auth' as const, to: ['first@example.test', 'second@example.test'] },
    { purpose: 'staff_auth' as const, attachments: [{ filename: 'report.pdf', content: 'synthetic' }] },
  ])('blocks other Preview mail before calling the provider: %j', async overrides => {
    vi.stubEnv('VERCEL_ENV', 'preview');
    vi.stubEnv('TRAJECTAS_PERSONALITY_PREVIEW_TARGET', 'bgrvqvtlhmfmvcytncgw');
    await expect(sendHtmlEmail({ ...base, ...overrides })).rejects.toThrow('only sends staff sign-in codes');
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it('also restricts the dedicated branch if its target marker is missing', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview');
    vi.stubEnv('VERCEL_GIT_COMMIT_REF', 'codex/personality-preview-ready-20261030');
    await expect(sendHtmlEmail(base)).rejects.toThrow('only sends staff sign-in codes');
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it.each(['production', 'development'])('preserves ordinary %s delivery', async environment => {
    vi.stubEnv('VERCEL_ENV', environment);
    vi.stubEnv('TRAJECTAS_PERSONALITY_PREVIEW_TARGET', 'bgrvqvtlhmfmvcytncgw');
    mocks.send.mockResolvedValue({ data: { id: 'normal-delivery' }, error: null });
    await expect(sendHtmlEmail(base)).resolves.toEqual({ id: 'normal-delivery' });
  });

  it('preserves another Preview branch mail policy', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview');
    vi.stubEnv('VERCEL_GIT_COMMIT_REF', 'codex/another-preview');
    mocks.send.mockResolvedValue({ data: { id: 'normal-preview-delivery' }, error: null });
    await expect(sendHtmlEmail(base)).resolves.toEqual({ id: 'normal-preview-delivery' });
  });

  it("throws when Resend returns an error instead of swallowing it", async () => {
    mocks.send.mockResolvedValue({
      data: null,
      error: { name: "validation_error", message: "The domain is not verified" },
    });

    await expect(sendHtmlEmail(base)).rejects.toThrow(/validation_error/);
    await expect(sendHtmlEmail(base)).rejects.toThrow(/domain is not verified/);
  });

  it("includes recipient count (not email addresses) in the thrown error for PII redaction", async () => {
    mocks.send.mockResolvedValue({
      data: null,
      error: { name: "rate_limit_exceeded", message: "Too many requests" },
    });

    await expect(
      sendHtmlEmail({ ...base, to: ["a@example.com", "b@example.com"] })
    ).rejects.toThrow(/2 recipient/);

    // Verify no email addresses leaked into the error
    await expect(
      sendHtmlEmail({ ...base, to: ["a@example.com", "b@example.com"] })
    ).rejects.not.toThrow(/a@example.com/);
  });
});
