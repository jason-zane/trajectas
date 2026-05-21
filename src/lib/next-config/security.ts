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

  const origins = Array.from(new Set([...configuredHosts, ...extraAllowedOrigins]));

  // Build-time assertion: serverActions.allowedOrigins is computed during
  // Next config evaluation, BEFORE any runtime instrumentation hook can
  // assert env presence. A misconfigured deploy with missing surface URL
  // envs would silently end up with a short allowedOrigins list, causing
  // Server Actions to 403 for hosts not in the list. Fail the build
  // instead — this matches the runtime assertion in src/instrumentation.ts.
  if (env.NODE_ENV === "production" && env.SKIP_SURFACE_URL_ASSERT !== "1") {
    const requiredKeys: Array<typeof surfaceUrlEnvKeys[number]> = [
      "PUBLIC_APP_URL",
      "ADMIN_APP_URL",
      "ASSESS_APP_URL",
    ];
    const missing = requiredKeys.filter((key) => !env[key]);
    if (missing.length > 0) {
      throw new Error(
        `Missing required surface URL env vars at build time: ${missing.join(", ")}. ` +
          `Configure them before building or set SKIP_SURFACE_URL_ASSERT=1 to bypass.`,
      );
    }
  }

  return origins;
}

export function getAllowedDevOrigins(
  env: NodeJS.ProcessEnv = process.env
): string[] {
  const configuredHosts = surfaceUrlEnvKeys
    .map((key) => extractConfiguredHost(env[key]))
    .filter(Boolean) as string[];

  const extraAllowedOrigins =
    env.NEXT_ALLOWED_DEV_ORIGINS?.split(",")
      .map((value) => value.trim())
      .filter(Boolean) ?? [];

  return Array.from(
    new Set(["localhost", "127.0.0.1", ...configuredHosts, ...extraAllowedOrigins])
  );
}

export function createTrajectasNextConfig(
  env: NodeJS.ProcessEnv = process.env
): NextConfig {
  return {
    allowedDevOrigins: getAllowedDevOrigins(env),
    // Prevent Turbopack from bundling packages with complex CJS internals.
    // They are loaded from node_modules at runtime instead.
    serverExternalPackages: [
      "@maily-to/render",
      "juice",
    ],
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
