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
  //
  // Gated to Vercel builds (VERCEL=1) because GitHub Actions `next build`
  // runs as a syntax/compile check without surface URL envs, and we do
  // not want CI to fail on a configuration concern that only matters at
  // deploy time. SKIP_SURFACE_URL_ASSERT=1 is a manual override (e.g. a
  // one-off `next build` against a preview env).
  if (
    env.VERCEL === "1" &&
    env.NODE_ENV === "production" &&
    env.SKIP_SURFACE_URL_ASSERT !== "1"
  ) {
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
    // Deployment skew protection: a builder tab left open across a deploy
    // otherwise POSTs stale server-action IDs, which surface as thrown
    // UnrecognizedActionError in whatever component fired the action. With a
    // deploymentId, Vercel routes those requests to the matching deployment.
    deploymentId: env.VERCEL_DEPLOYMENT_ID,
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
      // Client router cache for dynamic segments. Default is 0 — every
      // navigation refetches the RSC payload even when revisiting a page
      // seconds later. 30s makes back/forward and repeat navigation free;
      // mutations still invalidate via revalidatePath/Tag and
      // router.refresh as before.
      staleTimes: {
        dynamic: 30,
      },
      // lucide-react and date-fns are in Next's built-in list already;
      // @base-ui/react is not.
      optimizePackageImports: ["@base-ui/react"],
    },
    async redirects() {
      return [
        // /item-bank became /cognitive-items — the old name implied it was THE
        // item bank, which the Likert items under /items contradict. The review
        // queue is deliberately URL-shareable by lifecycle state, so links
        // already sent out have to keep resolving.
        {
          source: "/item-bank",
          destination: "/cognitive-items",
          permanent: true,
        },
        {
          source: "/item-bank/:path*",
          destination: "/cognitive-items/:path*",
          permanent: true,
        },
      ];
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
