import { createInviteLink, type InviteTenantType } from "@/lib/auth/staff-auth";
import { sendEmail } from "@/lib/email/send";

interface SendStaffInviteEmailInput {
  email: string;
  inviteToken: string;
  tenantType: InviteTenantType;
  tenantId?: string | null;
  inviteeName?: string | null;
}

export async function sendStaffInviteEmail(
  input: SendStaffInviteEmailInput
) {
  const inviteLink = createInviteLink(input.inviteToken);

  await sendEmail({
    type: "staff_invite",
    to: input.email,
    variables: {
      brandName: "Trajectas",
      inviteeName: input.inviteeName?.trim() || input.email,
      acceptUrl: inviteLink,
    },
    ...(input.tenantType === "client" && input.tenantId
      ? { scopeClientId: input.tenantId }
      : {}),
    ...(input.tenantType === "partner" && input.tenantId
      ? { scopePartnerId: input.tenantId }
      : {}),
  });

  return { inviteLink };
}
