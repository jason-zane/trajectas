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
  buildMagicLinkRedirectUrl,
  sendInviteMagicLinkEmail,
  sendStaffMagicLinkEmail,
} from "@/lib/auth/magic-link";

describe("magic link redirects", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.generateLink.mockResolvedValue({
      data: {
        properties: {
          action_link: "https://supabase.test/auth/v1/verify?token=abc",
        },
      },
      error: null,
    });
  });

  it("preserves callback query params on the current origin", () => {
    expect(
      buildMagicLinkRedirectUrl({
        origin: "https://trajectas.com",
        redirectPath: "/auth/callback?next=%2Fclient%2Fdashboard",
        publicAppUrl: "https://trajectas.com",
        adminAppUrl: "https://admin.trajectas.com",
      })
    ).toBe("https://trajectas.com/auth/callback?next=%2Fclient%2Fdashboard");
  });

  it("falls back to the public app url when request headers are unavailable", () => {
    expect(
      buildMagicLinkRedirectUrl({
        redirectPath: "/auth/callback?invite=abc123&next=%2Fpartner",
        publicAppUrl: "https://trajectas.com",
        adminAppUrl: "https://admin.trajectas.com",
      })
    ).toBe("https://trajectas.com/auth/callback?invite=abc123&next=%2Fpartner");
  });

  it("ignores invalid headers and falls back safely", () => {
    expect(
      buildMagicLinkRedirectUrl({
        origin: "not-a-url",
        referer: "also-not-a-url",
        redirectPath: "/auth/callback",
        adminAppUrl: "https://admin.trajectas.com",
      })
    ).toBe("https://admin.trajectas.com/auth/callback");
  });

  it("generates and sends a staff magic-link email through the app pipeline", async () => {
    await sendStaffMagicLinkEmail({
      email: "person@example.com",
      redirectUrl: "https://trajectas.com/auth/callback?next=%2Fclient",
    });

    expect(mocks.generateLink).toHaveBeenCalledWith({
      type: "magiclink",
      email: "person@example.com",
      options: {
        redirectTo: "https://trajectas.com/auth/callback?next=%2Fclient",
      },
    });
    expect(mocks.sendEmail).toHaveBeenCalledWith({
      type: "magic_link",
      to: "person@example.com",
      variables: {
        brandName: "Trajectas",
        signInUrl: "https://supabase.test/auth/v1/verify?token=abc",
      },
    });
  });

  it("generates and sends an invite-flavoured magic link email", async () => {
    await sendInviteMagicLinkEmail({
      email: "invitee@example.com",
      redirectUrl: "https://trajectas.com/auth/callback?invite=abc123",
      inviteeName: "Alex Johnson",
    });

    expect(mocks.sendEmail).toHaveBeenCalledWith({
      type: "staff_invite",
      to: "invitee@example.com",
      variables: {
        brandName: "Trajectas",
        inviteeName: "Alex Johnson",
        acceptUrl: "https://supabase.test/auth/v1/verify?token=abc",
      },
    });
  });

  it("throws when the admin api cannot generate a link", async () => {
    mocks.generateLink.mockResolvedValueOnce({
      data: { properties: null },
      error: { message: "generation failed" },
    });

    await expect(
      sendStaffMagicLinkEmail({
        email: "person@example.com",
        redirectUrl: "https://trajectas.com/auth/callback",
      })
    ).rejects.toThrow("generation failed");
  });
});
