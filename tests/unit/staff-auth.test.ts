import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildSurfaceAuthUrl,
  buildSurfaceDestinationUrl,
  getLegacyRoleForInvite,
  hashInviteToken,
  resolveDefaultWorkspaceContext,
} from "@/lib/auth/staff-auth";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("staff auth helpers", () => {
  it("hashes invite tokens deterministically", () => {
    expect(hashInviteToken("token-1")).toBe(hashInviteToken("token-1"));
    expect(hashInviteToken("token-1")).not.toBe(hashInviteToken("token-2"));
  });

  it("maps invite roles back to the current legacy profile role model", () => {
    expect(getLegacyRoleForInvite("platform_admin")).toBe("platform_admin");
    expect(getLegacyRoleForInvite("partner_admin")).toBe("partner_admin");
    expect(getLegacyRoleForInvite("client_admin")).toBe("org_admin");
    expect(getLegacyRoleForInvite("partner_member")).toBe("consultant");
    expect(getLegacyRoleForInvite("client_member")).toBe("consultant");
  });

  it("prefers an existing support or tenant context before deriving a default workspace", () => {
    expect(
      resolveDefaultWorkspaceContext({
        role: "platform_admin",
        partnerMemberships: [],
        clientMemberships: [],
        activeContext: {
          surface: "partner",
          tenantType: "partner",
          tenantId: "partner-1",
          membershipId: "membership-1",
        },
      })
    ).toEqual({
      surface: "partner",
      tenantType: "partner",
      tenantId: "partner-1",
      membershipId: "membership-1",
    });

    expect(
      resolveDefaultWorkspaceContext({
        role: "platform_admin",
        partnerMemberships: [],
        clientMemberships: [],
        activeContext: null,
      })
    ).toEqual({ surface: "admin" });
  });

  it("selects default memberships before fallback memberships", () => {
    expect(
      resolveDefaultWorkspaceContext({
        role: "consultant",
        activeContext: null,
        partnerMemberships: [
          {
            id: "partner-2-member",
            partnerId: "partner-2",
            role: "member",
            isDefault: false,
            createdAt: "2026-04-01T10:00:00.000Z",
          },
          {
            id: "partner-1-admin",
            partnerId: "partner-1",
            role: "admin",
            isDefault: true,
            createdAt: "2026-04-01T09:00:00.000Z",
          },
        ],
        clientMemberships: [],
      })
    ).toEqual({
      surface: "partner",
      tenantType: "partner",
      tenantId: "partner-1",
      membershipId: "partner-1-admin",
    });
  });

  it("builds partner and client destinations without duplicating local route prefixes", () => {
    vi.stubEnv("ADMIN_APP_URL", "http://127.0.0.1:3101");
    vi.stubEnv("PARTNER_APP_URL", "http://127.0.0.1:3101/partner");
    vi.stubEnv("CLIENT_APP_URL", "https://client.trajectas.test");

    expect(
      buildSurfaceDestinationUrl({
        surface: "partner",
        path: "/campaigns",
        requestUrl: "http://127.0.0.1:3101/auth/callback",
        host: "127.0.0.1:3101",
      }).toString()
    ).toBe("http://127.0.0.1:3101/partner/campaigns");

    expect(
      buildSurfaceDestinationUrl({
        surface: "client",
        path: "/results",
        requestUrl: "https://admin.trajectas.test/auth/callback",
        host: "admin.trajectas.test",
      }).toString()
    ).toBe("https://client.trajectas.test/results");
  });

  it("routes admin defaults to the dashboard surface root", () => {
    vi.stubEnv("ADMIN_APP_URL", "https://admin.trajectas.test");

    expect(
      buildSurfaceDestinationUrl({
        surface: "admin",
        path: "/",
        requestUrl: "https://trajectas.test/login",
        host: "trajectas.test",
      }).toString()
    ).toBe("https://admin.trajectas.test/dashboard");
  });

  it("builds host-local auth urls for production portal hosts", () => {
    vi.stubEnv("PARTNER_APP_URL", "https://partner.trajectas.test");

    const params = new URLSearchParams({
      email: "person@example.com",
      step: "code",
      next: "/partner",
    });

    expect(
      buildSurfaceAuthUrl({
        surface: "partner",
        authPath: "/login",
        requestUrl: "https://trajectas.test/login",
        host: "trajectas.test",
        params,
      }).toString()
    ).toBe(
      "https://partner.trajectas.test/login?email=person%40example.com&step=code&next=%2Fpartner"
    );
  });

  it("keeps auth urls on the current origin during local development", () => {
    const params = new URLSearchParams({
      invite: "invite-123",
      email: "person@example.com",
      step: "code",
    });

    expect(
      buildSurfaceAuthUrl({
        surface: "client",
        authPath: "/auth/accept",
        requestUrl: "http://127.0.0.1:3101/login",
        host: "127.0.0.1:3101",
        params,
      }).toString()
    ).toBe(
      "http://127.0.0.1:3101/auth/accept?invite=invite-123&email=person%40example.com&step=code"
    );
  });
});
