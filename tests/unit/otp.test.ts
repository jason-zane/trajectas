import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const generateLink = vi.fn();
  const sendEmail = vi.fn();

  return { generateLink, sendEmail };
});

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: {
      admin: {
        generateLink: mocks.generateLink,
      },
    },
  }),
}));

vi.mock("@/lib/email/send", () => ({
  sendEmail: mocks.sendEmail,
}));

import {
  buildAuthRedirectUrl,
  sendInviteOtpEmail,
  sendStaffOtpEmail,
} from "@/lib/auth/otp";

describe("OTP auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.generateLink.mockResolvedValue({
      data: {
        properties: {
          email_otp: "384291",
        },
      },
      error: null,
    });
  });

  describe("buildAuthRedirectUrl", () => {
    it("preserves callback query params on the current origin", () => {
      expect(
        buildAuthRedirectUrl({
          origin: "https://trajectas.com",
          redirectPath: "/auth/callback?next=%2Fclient%2Fdashboard",
          publicAppUrl: "https://trajectas.com",
          adminAppUrl: "https://admin.trajectas.com",
        })
      ).toBe("https://trajectas.com/auth/callback?next=%2Fclient%2Fdashboard");
    });

    it("falls back to public app url when request headers are unavailable", () => {
      expect(
        buildAuthRedirectUrl({
          redirectPath: "/auth/callback?invite=abc123&next=%2Fpartner",
          publicAppUrl: "https://trajectas.com",
          adminAppUrl: "https://admin.trajectas.com",
        })
      ).toBe(
        "https://trajectas.com/auth/callback?invite=abc123&next=%2Fpartner"
      );
    });

    it("falls back to localhost when no urls are provided", () => {
      expect(
        buildAuthRedirectUrl({
          redirectPath: "/auth/callback",
        })
      ).toBe("http://localhost:3002/auth/callback");
    });
  });

  describe("sendStaffOtpEmail", () => {
    it("sends an email with the OTP code", async () => {
      await sendStaffOtpEmail({
        email: "person@example.com",
        redirectUrl: "https://trajectas.com/auth/callback",
      });

      expect(mocks.generateLink).toHaveBeenCalledWith({
        type: "magiclink",
        email: "person@example.com",
        options: {
          redirectTo: "https://trajectas.com/auth/callback",
        },
      });

      expect(mocks.sendEmail).toHaveBeenCalledWith({
        type: "magic_link",
        to: "person@example.com",
        variables: {
          brandName: "Trajectas",
          otpCode: "384291",
        },
      });
    });

    it("throws when the admin api cannot generate a link", async () => {
      mocks.generateLink.mockResolvedValueOnce({
        data: { properties: null },
        error: { message: "generation failed" },
      });

      await expect(
        sendStaffOtpEmail({
          email: "person@example.com",
          redirectUrl: "https://trajectas.com/auth/callback",
        })
      ).rejects.toThrow("generation failed");
    });
  });

  describe("sendInviteOtpEmail", () => {
    it("sends an invite email with the OTP code", async () => {
      await sendInviteOtpEmail({
        email: "invitee@example.com",
        redirectUrl: "https://trajectas.com/auth/callback?invite=abc",
        inviteeName: "Alice",
      });

      expect(mocks.sendEmail).toHaveBeenCalledWith({
        type: "staff_invite",
        to: "invitee@example.com",
        variables: {
          brandName: "Trajectas",
          inviteeName: "Alice",
          otpCode: "384291",
        },
      });
    });

    it("falls back to email when inviteeName is blank", async () => {
      await sendInviteOtpEmail({
        email: "invitee@example.com",
        redirectUrl: "https://trajectas.com/auth/callback",
        inviteeName: "  ",
      });

      expect(mocks.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: expect.objectContaining({
            inviteeName: "invitee@example.com",
          }),
        })
      );
    });
  });
});
