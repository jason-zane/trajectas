import { withBotId } from "botid/next/config";
import { createTrajectasNextConfig } from "@/lib/next-config/security";

import { assertPersonalityPreviewEnvironment } from "@/lib/next-config/personality-preview-safety";

assertPersonalityPreviewEnvironment(process.env);

const nextConfig = createTrajectasNextConfig();

export default withBotId(nextConfig);
