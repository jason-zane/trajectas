import { describe, expect, it } from "vitest";
import {
  createTalentFitNextConfig,
  getAllowedServerActionOrigins,
  SECURITY_HEADERS,
} from "@/lib/next-config/security";

describe("next config security helpers", () => {
  it("collects configured server action origins and de-duplicates extras", () => {
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: "test",
      ASSESS_APP_URL: "https://assess.talentfit.test",
      ADMIN_APP_URL: "https://admin.talentfit.test",
      PARTNER_APP_URL: "not-a-url",
      SERVER_ACTION_ALLOWED_ORIGINS:
        "admin.talentfit.test,*.preview.talentfit.test",
    };

    expect(getAllowedServerActionOrigins(env)).toEqual([
      "assess.talentfit.test",
      "admin.talentfit.test",
      "*.preview.talentfit.test",
    ]);
  });

  it("builds the expected next config contract", async () => {
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: "test",
      PUBLIC_APP_URL: "https://talentfit.test",
      ADMIN_APP_URL: "https://admin.talentfit.test",
    };
    const config = createTalentFitNextConfig(env);
    const headers = await config.headers?.();

    expect(config.experimental?.serverActions).toEqual({
      allowedOrigins: ["talentfit.test", "admin.talentfit.test"],
      bodySizeLimit: "2mb",
    });
    expect(headers).toEqual([
      {
        source: "/:path*",
        headers: [...SECURITY_HEADERS],
      },
    ]);
  });
});
