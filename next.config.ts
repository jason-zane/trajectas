import { withBotId } from "botid/next/config";
import { createTrajectasNextConfig } from "@/lib/next-config/security";
import { verifyPersonalityPreviewEnvironment } from "@/lib/next-config/personality-preview-safety";

export default async function nextConfig() {
  await verifyPersonalityPreviewEnvironment(process.env);
  return withBotId(createTrajectasNextConfig());
}
