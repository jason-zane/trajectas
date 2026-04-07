import { sendEmail } from "@/lib/email/send";
import { createAdminClient } from "@/lib/supabase/admin";

interface MagicLinkRedirectInput {
  origin?: string | null;
  referer?: string | null;
  redirectPath: string;
  publicAppUrl?: string | null;
  adminAppUrl?: string | null;
  fallbackUrl?: string | null;
}

function resolveMagicLinkBaseUrl(input: Omit<MagicLinkRedirectInput, "redirectPath">) {
  const candidates = [
    input.origin,
    input.referer,
    input.publicAppUrl,
    input.adminAppUrl,
    input.fallbackUrl,
    "http://localhost:3002",
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;

    try {
      return new URL(candidate).origin;
    } catch {
      continue;
    }
  }

  return "http://localhost:3002";
}

export function buildMagicLinkRedirectUrl(input: MagicLinkRedirectInput) {
  return new URL(
    input.redirectPath,
    resolveMagicLinkBaseUrl({
      origin: input.origin,
      referer: input.referer,
      publicAppUrl: input.publicAppUrl,
      adminAppUrl: input.adminAppUrl,
      fallbackUrl: input.fallbackUrl,
    })
  ).toString();
}

async function generateMagicLinkActionUrl(input: {
  email: string;
  redirectUrl: string;
}) {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: input.email,
    options: {
      redirectTo: input.redirectUrl,
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  const actionLink = data?.properties?.action_link;
  if (!actionLink) {
    throw new Error("Magic link generation did not return an action link.");
  }

  return actionLink;
}

export async function sendStaffMagicLinkEmail(input: {
  email: string;
  redirectUrl: string;
}) {
  const actionLink = await generateMagicLinkActionUrl(input);
  await sendEmail({
    type: "magic_link",
    to: input.email,
    variables: {
      brandName: "Trajectas",
      signInUrl: actionLink,
    },
  });
}

export async function sendInviteMagicLinkEmail(input: {
  email: string;
  redirectUrl: string;
  inviteeName?: string | null;
}) {
  const actionLink = await generateMagicLinkActionUrl(input);
  await sendEmail({
    type: "staff_invite",
    to: input.email,
    variables: {
      brandName: "Trajectas",
      inviteeName: input.inviteeName?.trim() || input.email,
      acceptUrl: actionLink,
    },
  });
}
