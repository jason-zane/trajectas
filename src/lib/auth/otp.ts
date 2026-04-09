import { sendEmail } from "@/lib/email/send";
import { createAdminClient } from "@/lib/supabase/admin";

interface AuthRedirectInput {
  origin?: string | null;
  referer?: string | null;
  redirectPath: string;
  publicAppUrl?: string | null;
  adminAppUrl?: string | null;
  fallbackUrl?: string | null;
}

function resolveBaseUrl(input: Omit<AuthRedirectInput, "redirectPath">) {
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

export function buildAuthRedirectUrl(input: AuthRedirectInput) {
  return new URL(
    input.redirectPath,
    resolveBaseUrl({
      origin: input.origin,
      referer: input.referer,
      publicAppUrl: input.publicAppUrl,
      adminAppUrl: input.adminAppUrl,
      fallbackUrl: input.fallbackUrl,
    })
  ).toString();
}

async function generateOtpCode(input: {
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

  const otpCode = data?.properties?.email_otp;
  if (!otpCode) {
    throw new Error("OTP generation did not return an email code.");
  }

  return otpCode;
}

export async function sendStaffOtpEmail(input: {
  email: string;
  redirectUrl: string;
}) {
  const otpCode = await generateOtpCode(input);
  await sendEmail({
    type: "magic_link",
    to: input.email,
    variables: {
      brandName: "Trajectas",
      otpCode,
    },
  });
}
