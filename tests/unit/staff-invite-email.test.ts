import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const sendEmail = vi.fn();
  const createInviteLink = vi.fn();
  const reportError = vi.fn();

  return { sendEmail, createInviteLink, reportError };
});

vi.mock("@/lib/email/send", () => ({
  sendEmail: mocks.sendEmail,
}));

vi.mock("@/lib/auth/staff-auth", () => ({
  createInviteLink: mocks.createInviteLink,
}));

vi.mock("@/lib/observability/report-error", () => ({
  reportError: mocks.reportError,
}));

import { sendStaffInviteEmail } from "@/lib/auth/staff-invite-email";

describe("sendStaffInviteEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createInviteLink.mockReturnValue("https://trajectas.test/auth/accept?invite=token-1");
  });

  it("sends a platform invite with the acceptance link", async () => {
    await sendStaffInviteEmail({
      email: "invitee@example.com",
      inviteToken: "token-1",
      tenantType: "platform",
    });

    expect(mocks.createInviteLink).toHaveBeenCalledWith("token-1");
    expect(mocks.sendEmail).toHaveBeenCalledWith({
      type: "staff_invite",
      to: "invitee@example.com",
      variables: {
        brandName: "Trajectas",
        inviteeName: "invitee@example.com",
        acceptUrl: "https://trajectas.test/auth/accept?invite=token-1",
      },
    });
  });

  it("passes partner scope when resending a partner invite", async () => {
    await sendStaffInviteEmail({
      email: "invitee@example.com",
      inviteToken: "token-1",
      tenantType: "partner",
      tenantId: "partner-uuid-123",
      inviteeName: "Alex",
    });

    expect(mocks.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        scopePartnerId: "partner-uuid-123",
        variables: expect.objectContaining({
          inviteeName: "Alex",
        }),
      })
    );
  });

  it("passes client scope when resending a client invite", async () => {
    await sendStaffInviteEmail({
      email: "invitee@example.com",
      inviteToken: "token-1",
      tenantType: "client",
      tenantId: "client-uuid-123",
    });

    expect(mocks.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        scopeClientId: "client-uuid-123",
      })
    );
  });

  it("returns the link and emailDelivered=true when the send succeeds", async () => {
    mocks.sendEmail.mockResolvedValueOnce(undefined);

    const result = await sendStaffInviteEmail({
      email: "invitee@example.com",
      inviteToken: "token-1",
      tenantType: "platform",
    });

    expect(result).toEqual({
      inviteLink: "https://trajectas.test/auth/accept?invite=token-1",
      emailDelivered: true,
    });
    expect(mocks.reportError).not.toHaveBeenCalled();
  });

  it("reports the failure but still returns the link when the send fails", async () => {
    mocks.sendEmail.mockRejectedValueOnce(new Error("Resend rejected email"));

    const result = await sendStaffInviteEmail({
      email: "invitee@example.com",
      inviteToken: "token-1",
      tenantType: "client",
      tenantId: "client-uuid-123",
    });

    // The invite row already exists, so the admin can still share the link.
    expect(result).toEqual({
      inviteLink: "https://trajectas.test/auth/accept?invite=token-1",
      emailDelivered: false,
    });
    // The failure is surfaced to observability rather than swallowed.
    expect(mocks.reportError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        source: "auth.staff-invite-email",
        context: expect.objectContaining({ email: "invitee@example.com" }),
      })
    );
  });
});
