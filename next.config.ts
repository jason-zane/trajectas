import { withSentryConfig } from "@sentry/nextjs";
import { withBotId } from "botid/next/config";
import { createTrajectasNextConfig } from "@/lib/next-config/security";

const nextConfig = createTrajectasNextConfig();

export default withSentryConfig(withBotId(nextConfig), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  hideSourceMaps: true,
  disableLogger: true,
  reactComponentAnnotation: { enabled: true },
});
