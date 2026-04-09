import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const sendEmail = vi.fn();
  const createInviteLink = vi.fn();

  return { sendEmail, createInviteLink };
});

vi.mock("@/lib/email/send", () => ({
  sendEmail: mocks.sendEmail,
}));

vi.mock("@/lib/auth/staff-auth", () => ({
  createInviteLink: mocks.createInviteLink,
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
});
