import { withBotId } from "botid/next/config";
import { createTrajectasNextConfig } from "@/lib/next-config/security";

const nextConfig = createTrajectasNextConfig();

export default withBotId(nextConfig);
