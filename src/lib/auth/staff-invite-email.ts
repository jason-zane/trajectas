import { createInviteLink, type InviteTenantType } from "@/lib/auth/staff-auth";
import { sendEmail } from "@/lib/email/send";
import { reportError } from "@/lib/observability/report-error";

interface SendStaffInviteEmailInput {
  email: string;
  inviteToken: string;
  tenantType: InviteTenantType;
  tenantId?: string | null;
  inviteeName?: string | null;
}

/**
 * Sends the staff-invite email and returns the accept link.
 *
 * The email send is best-effort: a delivery failure is reported to
 * observability (and alerted) rather than thrown, because the invite row has
 * already been created and the returned `inviteLink` lets an admin share the
 * invite manually. `emailDelivered` reports whether the send succeeded.
 */
export async function sendStaffInviteEmail(
  input: SendStaffInviteEmailInput
) {
  const inviteLink = createInviteLink(input.inviteToken);

  let emailDelivered = true;
  try {
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
  } catch (error) {
    emailDelivered = false;
    await reportError(error, {
      source: "auth.staff-invite-email",
      context: {
        email: input.email,
        tenantType: input.tenantType,
        tenantId: input.tenantId ?? null,
      },
      alert: true,
    });
  }

  return { inviteLink, emailDelivered };
}
