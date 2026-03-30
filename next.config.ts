import type { NextConfig } from "next";

const surfaceUrlEnvKeys = [
  "PUBLIC_APP_URL",
  "ASSESS_APP_URL",
  "ADMIN_APP_URL",
  "PARTNER_APP_URL",
  "CLIENT_APP_URL",
] as const;

function getAllowedServerActionOrigins() {
  const configuredHosts = surfaceUrlEnvKeys
    .map((key) => process.env[key])
    .flatMap((value) => {
      if (!value) return [];

      try {
        return [new URL(value).host];
      } catch {
        return [];
      }
    });

  const extraAllowedOrigins =
    process.env.SERVER_ACTION_ALLOWED_ORIGINS?.split(",")
      .map((value) => value.trim())
      .filter(Boolean) ?? [];

  return Array.from(new Set([...configuredHosts, ...extraAllowedOrigins]));
}

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: getAllowedServerActionOrigins(),
      bodySizeLimit: "2mb",
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
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
        ],
      },
    ];
  },
};

export default nextConfig;
