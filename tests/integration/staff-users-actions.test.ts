import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  requireAdminScope: vi.fn(),
}));

const staffAuth = vi.hoisted(() => ({
  createStaffInvite: vi.fn(),
}));

const inviteEmail = vi.hoisted(() => ({
  sendStaffInviteEmail: vi.fn(),
}));

const cache = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth/authorization", () => ({
  requireAdminScope: auth.requireAdminScope,
}));

vi.mock("@/lib/auth/staff-auth", () => ({
  createStaffInvite: staffAuth.createStaffInvite,
}));

vi.mock("@/lib/auth/staff-invite-email", () => ({
  sendStaffInviteEmail: inviteEmail.sendStaffInviteEmail,
}));

vi.mock("next/cache", () => ({
  revalidatePath: cache.revalidatePath,
}));

import { createStaffInviteAction } from "@/app/actions/staff-users";

describe("staff user actions", () => {
  beforeEach(() => {
    auth.requireAdminScope.mockReset();
    staffAuth.createStaffInvite.mockReset();
    inviteEmail.sendStaffInviteEmail.mockReset();
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
        tenantType: "platform",
        tenantId: null,
      },
      inviteToken: "token-1",
    });
    inviteEmail.sendStaffInviteEmail.mockResolvedValueOnce({
      inviteLink: "https://trajectas.test/auth/accept?invite=token-1",
    });

    const formData = new FormData();
    formData.set("email", "person@example.com");
    formData.set("tenantType", "platform");
    formData.set("role", "platform_admin");

    await expect(createStaffInviteAction(undefined, formData)).resolves.toEqual({
      success: "Invite email sent to person@example.com.",
      inviteLink: "https://trajectas.test/auth/accept?invite=token-1",
    });
  });
});
