import type { NextConfig } from "next";

export const surfaceUrlEnvKeys = [
  "PUBLIC_APP_URL",
  "ASSESS_APP_URL",
  "ADMIN_APP_URL",
  "PARTNER_APP_URL",
  "CLIENT_APP_URL",
] as const;

export const SECURITY_HEADERS = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-DNS-Prefetch-Control",
    value: "off",
  },
  {
    key: "Permissions-Policy",
    value:
      "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
] as const;

function extractConfiguredHost(value: string | undefined): string | null {
  if (!value) return null;

  try {
    return new URL(value).host;
  } catch {
    return null;
  }
}

export function getAllowedServerActionOrigins(
  env: NodeJS.ProcessEnv = process.env
): string[] {
  const configuredHosts = surfaceUrlEnvKeys
    .map((key) => extractConfiguredHost(env[key]))
    .filter(Boolean) as string[];

  const extraAllowedOrigins =
    env.SERVER_ACTION_ALLOWED_ORIGINS?.split(",")
      .map((value) => value.trim())
      .filter(Boolean) ?? [];

  return Array.from(new Set([...configuredHosts, ...extraAllowedOrigins]));
}

export function createTalentFitNextConfig(
  env: NodeJS.ProcessEnv = process.env
): NextConfig {
  return {
    experimental: {
      serverActions: {
        allowedOrigins: getAllowedServerActionOrigins(env),
        bodySizeLimit: "2mb",
      },
    },
    async headers() {
      return [
        {
          source: "/:path*",
          headers: [...SECURITY_HEADERS],
        },
      ];
    },
  };
}
