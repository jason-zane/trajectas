import { beforeEach, describe, expect, it, vi } from "vitest";
const mocked = vi.hoisted(() => ({ cookies: vi.fn(), decode: vi.fn(), mode: vi.fn(), db: vi.fn(), read: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: mocked.cookies }));
vi.mock("@/lib/public-builds/cookie", () => ({ PUBLIC_BUILD_COOKIE: "tf_public_build", decodePublicBuildCookie: mocked.decode }));
vi.mock("@/lib/public-builds/constants", () => ({ getPublicBuildsMode: mocked.mode }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocked.db }));
vi.mock("@/lib/dal/public-builds", () => ({ getResumablePublicBuild: mocked.read }));
vi.mock("@/lib/security/action-errors", () => ({ logActionError: vi.fn() }));
import { getPublicBuildSession } from "@/app/actions/public-builds-session";
import { recommendedPublicPickCount } from "@/lib/public-builds/session";
beforeEach(() => { mocked.mode.mockReturnValue("open"); mocked.cookies.mockResolvedValue({ get: () => ({ value: "signed-cookie" }) }); mocked.decode.mockReturnValue(null); });
describe("public build recovery", () => {
  it("does not access the database without a valid signed cookie", async () => {
    expect(await getPublicBuildSession()).toEqual({ email: null, build: null }); expect(mocked.db).not.toHaveBeenCalled(); expect(mocked.read).not.toHaveBeenCalled();
  });
  it("does not recover data while the feature is off", async () => {
    mocked.mode.mockReturnValue("off"); expect(await getPublicBuildSession()).toEqual({ email: null, build: null }); expect(mocked.cookies).not.toHaveBeenCalled();
  });
  it("uses the email from the signed cookie for the owned lookup", async () => {
    mocked.decode.mockReturnValue({ email: "owner@example.com" }); mocked.db.mockReturnValue("server-db"); mocked.read.mockResolvedValue(null);
    expect(await getPublicBuildSession()).toEqual({ email: "owner@example.com", build: null }); expect(mocked.read).toHaveBeenCalledWith("server-db", "owner@example.com");
  });
  it("returns a recoverable error rather than a blank new build on lookup failure", async () => {
    mocked.decode.mockReturnValue({ email: "owner@example.com" }); mocked.read.mockRejectedValue(new Error("database unavailable"));
    expect(await getPublicBuildSession()).toEqual({ error: expect.stringContaining("couldn’t recover") });
  });
  it("bounds recommendations to the supported size and available library", () => {
    expect(recommendedPublicPickCount(12, 20)).toBe(8); expect(recommendedPublicPickCount(2, 20)).toBe(4); expect(recommendedPublicPickCount(6, 3)).toBe(3); expect(recommendedPublicPickCount(NaN, 8)).toBe(6);
  });
});
