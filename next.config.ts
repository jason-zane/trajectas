import { withSentryConfig } from "@sentry/nextjs";
import { createTrajectasNextConfig } from "@/lib/next-config/security";

const nextConfig = createTrajectasNextConfig();

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
});
