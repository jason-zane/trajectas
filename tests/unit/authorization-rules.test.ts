import { describe, expect, it } from "vitest";
import {
  AuthorizationError,
  assertAdminOnly,
  canAccessClient,
  canAccessPartner,
  canManageClient,
  canManageClientDirectory,
  getPreferredPartnerIdForClientCreation,
  type AuthorizedScope,
} from "@/lib/auth/authorization";

function createScope(
  overrides: Partial<AuthorizedScope> = {}
): AuthorizedScope {
  return {
    actor: null,
    activeContext: null,
    previewContext: null,
    requestSurface: "admin",
    isPlatformAdmin: false,
    isLocalDevelopmentBypass: false,
    partnerIds: [],
    partnerAdminIds: [],
    clientIds: [],
    clientAdminIds: [],
    supportSession: null,
    ...overrides,
  };
}

describe("authorization rules", () => {
  it("allows platform admins to access and manage all tenant scopes", () => {
    const scope = createScope({ isPlatformAdmin: true });

    expect(canAccessClient(scope, "client-1")).toBe(true);
    expect(canManageClient(scope, "client-1")).toBe(true);
    expect(canManageClientDirectory(scope)).toBe(true);
    expect(canAccessPartner(scope, "partner-1")).toBe(true);
    expect(getPreferredPartnerIdForClientCreation(scope)).toBeNull();
    expect(() => assertAdminOnly(scope)).not.toThrow();
  });

  it("grants partner-scoped operators client directory access and preferred partner selection", () => {
    const scope = createScope({
      partnerIds: ["partner-1"],
      partnerAdminIds: ["partner-1"],
      activeContext: {
        surface: "partner",
        tenantType: "partner",
        tenantId: "partner-1",
      },
    });

    expect(canManageClient(scope, "client-1")).toBe(true);
    expect(canManageClientDirectory(scope)).toBe(true);
    expect(canAccessPartner(scope, "partner-1")).toBe(true);
    expect(getPreferredPartnerIdForClientCreation(scope)).toBe("partner-1");
    expect(() => assertAdminOnly(scope)).toThrow(AuthorizationError);
  });

  it("restricts client-scoped actors to their own clients", () => {
    const scope = createScope({
      clientIds: ["client-1"],
      clientAdminIds: ["client-1"],
    });

    expect(canAccessClient(scope, "client-1")).toBe(true);
    expect(canAccessClient(scope, "client-2")).toBe(false);
    expect(canManageClient(scope, "client-1")).toBe(true);
    expect(canManageClient(scope, "client-2")).toBe(false);
    expect(canManageClientDirectory(scope)).toBe(false);
    expect(canAccessPartner(scope, "partner-1")).toBe(false);
  });

  it("requires an active partner context when a non-platform user has multiple partners", () => {
    const scope = createScope({
      partnerIds: ["partner-1", "partner-2"],
    });

    expect(() => getPreferredPartnerIdForClientCreation(scope)).toThrow(
      "Select an active partner context before creating a client."
    );
  });
});
