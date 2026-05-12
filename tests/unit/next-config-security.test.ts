import { describe, expect, it } from "vitest";
import {
  createTrajectasNextConfig,
  getAllowedDevOrigins,
  getAllowedServerActionOrigins,
  SECURITY_HEADERS,
} from "@/lib/next-config/security";

describe("next config security helpers", () => {
  it("collects configured server action origins and de-duplicates extras", () => {
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: "test",
      ASSESS_APP_URL: "https://assess.trajectas.test",
      ADMIN_APP_URL: "https://admin.trajectas.test",
      PARTNER_APP_URL: "not-a-url",
      SERVER_ACTION_ALLOWED_ORIGINS:
        "admin.trajectas.test,*.preview.trajectas.test",
    };

    expect(getAllowedServerActionOrigins(env)).toEqual([
      "assess.trajectas.test",
      "admin.trajectas.test",
      "*.preview.trajectas.test",
    ]);
  });

  it("allows local dev origins used by Next dev and Playwright", () => {
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: "test",
      PUBLIC_APP_URL: "http://127.0.0.1:3101",
      NEXT_ALLOWED_DEV_ORIGINS: "local.trajectas.test,localhost",
    };

    expect(getAllowedDevOrigins(env)).toEqual([
      "localhost",
      "127.0.0.1",
      "127.0.0.1:3101",
      "local.trajectas.test",
    ]);
  });

  it("builds the expected next config contract", async () => {
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: "test",
      PUBLIC_APP_URL: "https://trajectas.test",
      ADMIN_APP_URL: "https://admin.trajectas.test",
    };
    const config = createTrajectasNextConfig(env);
    const headers = await config.headers?.();

    expect(config.experimental?.serverActions).toEqual({
      allowedOrigins: ["trajectas.test", "admin.trajectas.test"],
      bodySizeLimit: "2mb",
    });
    expect(config.allowedDevOrigins).toEqual([
      "localhost",
      "127.0.0.1",
      "trajectas.test",
      "admin.trajectas.test",
    ]);
    expect(headers).toEqual([
      {
        source: "/:path*",
        headers: [...SECURITY_HEADERS],
      },
    ]);
    expect(SECURITY_HEADERS).toContainEqual({
      key: "Strict-Transport-Security",
      value: "max-age=31536000; includeSubDomains",
    });
  });
});
