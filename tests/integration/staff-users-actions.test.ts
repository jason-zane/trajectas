import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  requireAdminScope: vi.fn(),
}));

const staffAuth = vi.hoisted(() => ({
  createStaffInvite: vi.fn(),
  createInviteLink: vi.fn(),
}));

const cache = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth/authorization", () => ({
  requireAdminScope: auth.requireAdminScope,
}));

vi.mock("@/lib/auth/staff-auth", () => ({
  createStaffInvite: staffAuth.createStaffInvite,
  createInviteLink: staffAuth.createInviteLink,
}));

vi.mock("next/cache", () => ({
  revalidatePath: cache.revalidatePath,
}));

import { createStaffInviteAction } from "@/app/actions/staff-users";

describe("staff user actions", () => {
  beforeEach(() => {
    auth.requireAdminScope.mockReset();
    staffAuth.createStaffInvite.mockReset();
    staffAuth.createInviteLink.mockReset();
    cache.revalidatePath.mockReset();
  });

  it("returns field errors from invite validation failures", async () => {
    auth.requireAdminScope.mockResolvedValueOnce({
      actor: { id: "actor-1" },
    });
    staffAuth.createStaffInvite.mockResolvedValueOnce({
      error: {
        email: ["Enter a valid email address."],
      },
    });

    const formData = new FormData();
    formData.set("email", "bad-email");
    formData.set("tenantType", "platform");
    formData.set("role", "platform_admin");

    await expect(createStaffInviteAction(undefined, formData)).resolves.toEqual({
      fields: {
        email: ["Enter a valid email address."],
      },
      error: undefined,
    });
  });

  it("returns a copyable invite link on success", async () => {
    auth.requireAdminScope.mockResolvedValueOnce({
      actor: { id: "actor-1" },
    });
    staffAuth.createStaffInvite.mockResolvedValueOnce({
      data: {
        id: "invite-1",
        email: "person@example.com",
      },
      inviteToken: "token-1",
    });
    staffAuth.createInviteLink.mockReturnValueOnce(
      "https://talentfit.test/auth/accept?invite=token-1"
    );

    const formData = new FormData();
    formData.set("email", "person@example.com");
    formData.set("tenantType", "platform");
    formData.set("role", "platform_admin");

    await expect(createStaffInviteAction(undefined, formData)).resolves.toEqual({
      success: "Invite created for person@example.com. Copy the acceptance link below.",
      inviteLink: "https://talentfit.test/auth/accept?invite=token-1",
    });
  });
});
