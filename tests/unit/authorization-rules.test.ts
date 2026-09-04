import { describe, expect, it } from "vitest";
import {
  AuthorizationError,
  assertAdminOnly,
  assertIndividualResultsAccess,
  canManageCampaign,
  canAccessClient,
  canAccessPartner,
  canManageClientAssignment,
  canManageClient,
  canManageClientDirectory,
  canManagePartnerDirectory,
  canManageReportTemplateLibrary,
  getPreferredPartnerIdForClientCreation,
  getPreferredPartnerIdForReportTemplateCreation,
  applyTenantClientFilter,
  resolveTenantClientFilter,
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

// =============================================================================
// Platform Admin
// =============================================================================

describe("authorization rules", () => {
  describe("platform admin", () => {
    it("can access and manage all tenant scopes", () => {
      const scope = createScope({ isPlatformAdmin: true });

      expect(canAccessClient(scope, "client-1")).toBe(true);
      expect(canAccessClient(scope, "client-999")).toBe(true);
      expect(canManageClient(scope, "client-1", null)).toBe(true);
      expect(canManageClient(scope, "client-1", "partner-1")).toBe(true);
      expect(canManageClientDirectory(scope)).toBe(true);
      expect(canManageClientAssignment(scope)).toBe(true);
      expect(canManageCampaign(scope, "partner-1", "client-1")).toBe(true);
      expect(canManageReportTemplateLibrary(scope)).toBe(true);
      expect(canManagePartnerDirectory(scope)).toBe(true);
      expect(canAccessPartner(scope, "partner-1")).toBe(true);
      expect(canAccessPartner(scope, "partner-999")).toBe(true);
      expect(getPreferredPartnerIdForClientCreation(scope)).toBeNull();
      expect(getPreferredPartnerIdForReportTemplateCreation(scope)).toBeNull();
      expect(() => assertAdminOnly(scope)).not.toThrow();
    });

    it("on client surface still has isPlatformAdmin false", () => {
      // This is the surface-gating behavior — isPlatformAdmin is only true on admin surface
      const scope = createScope({
        isPlatformAdmin: false, // surface is client, so this is false
        requestSurface: "client",
        clientIds: ["client-1", "client-2"], // but has access to all clients
      });

      // Cannot use admin-only functions
      expect(() => assertAdminOnly(scope)).toThrow(AuthorizationError);
      expect(canManageClientAssignment(scope)).toBe(false);

      // But CAN access clients through clientIds
      expect(canAccessClient(scope, "client-1")).toBe(true);
      expect(canAccessClient(scope, "client-2")).toBe(true);
    });
  });

  // =============================================================================
  // Aggregate-only confidentiality
  // =============================================================================

  describe("assertIndividualResultsAccess", () => {
    it("permits any viewer on a standard (or unset) campaign", () => {
      const client = createScope({ clientIds: ["client-1"] });
      expect(() => assertIndividualResultsAccess(client, "standard")).not.toThrow();
      expect(() => assertIndividualResultsAccess(client, null)).not.toThrow();
      expect(() =>
        assertIndividualResultsAccess(client, undefined),
      ).not.toThrow();
    });

    it("throws for a non-platform-admin on an aggregate-only campaign", () => {
      const client = createScope({ clientIds: ["client-1"] });
      expect(() =>
        assertIndividualResultsAccess(client, "aggregate_only"),
      ).toThrow(AuthorizationError);
    });

    it("permits a platform admin on an aggregate-only campaign", () => {
      const admin = createScope({ isPlatformAdmin: true });
      expect(() =>
        assertIndividualResultsAccess(admin, "aggregate_only"),
      ).not.toThrow();
    });
  });

  // =============================================================================
  // Partner Admin — Cross-Partner Isolation
  // =============================================================================

  describe("partner admin", () => {
    const partnerAScope = createScope({
      partnerIds: ["partner-a"],
      partnerAdminIds: ["partner-a"],
      clientIds: ["client-a1", "client-a2"],
      activeContext: {
        surface: "partner",
        tenantType: "partner",
        tenantId: "partner-a",
      },
    });

    it("can access their own partner", () => {
      expect(canAccessPartner(partnerAScope, "partner-a")).toBe(true);
    });

    it("cannot access other partners", () => {
      expect(canAccessPartner(partnerAScope, "partner-b")).toBe(false);
    });

    it("can access their own partner's clients", () => {
      expect(canAccessClient(partnerAScope, "client-a1")).toBe(true);
      expect(canAccessClient(partnerAScope, "client-a2")).toBe(true);
    });

    it("cannot access other partners' clients", () => {
      expect(canAccessClient(partnerAScope, "client-b1")).toBe(false);
    });

    it("can manage clients belonging to their partner", () => {
      expect(canManageClient(partnerAScope, "client-a1", "partner-a")).toBe(true);
    });

    it("can manage campaigns and report templates for their own partner", () => {
      expect(canManageCampaign(partnerAScope, "partner-a", "client-a1")).toBe(true);
      expect(canManageReportTemplateLibrary(partnerAScope)).toBe(true);
      expect(getPreferredPartnerIdForReportTemplateCreation(partnerAScope)).toBe("partner-a");
    });

    it("cannot manage clients belonging to other partners", () => {
      expect(canManageClient(partnerAScope, "client-b1", "partner-b")).toBe(false);
    });

    it("cannot manage campaigns for other partners", () => {
      expect(canManageCampaign(partnerAScope, "partner-b", "client-b1")).toBe(false);
    });

    it("cannot manage clients with unknown partner relationship", () => {
      expect(canManageClient(partnerAScope, "client-x")).toBe(false);
      expect(canManageClient(partnerAScope, "client-x", null)).toBe(false);
    });

    it("can manage client directory but not assignments", () => {
      expect(canManageClientDirectory(partnerAScope)).toBe(true);
      expect(canManageClientAssignment(partnerAScope)).toBe(false);
    });

    it("cannot manage partner directory", () => {
      expect(canManagePartnerDirectory(partnerAScope)).toBe(false);
    });

    it("has preferred partner for client creation", () => {
      expect(getPreferredPartnerIdForClientCreation(partnerAScope)).toBe("partner-a");
    });

    it("is not treated as admin-only", () => {
      expect(() => assertAdminOnly(partnerAScope)).toThrow(AuthorizationError);
    });
  });

  describe("partner member (non-admin)", () => {
    const memberScope = createScope({
      partnerIds: ["partner-a"],
      partnerAdminIds: [], // NOT an admin
      clientIds: ["client-a1"],
    });

    it("cannot manage client directory", () => {
      expect(canManageClientDirectory(memberScope)).toBe(false);
    });

    it("cannot manage any client", () => {
      expect(canManageClient(memberScope, "client-a1", "partner-a")).toBe(false);
    });

    it("cannot manage campaigns or report templates", () => {
      expect(canManageCampaign(memberScope, "partner-a", "client-a1")).toBe(false);
      expect(canManageReportTemplateLibrary(memberScope)).toBe(false);
    });

    it("can still access their partner's clients", () => {
      expect(canAccessClient(memberScope, "client-a1")).toBe(true);
    });
  });

  describe("partner admin with multiple partners", () => {
    it("requires active context to create a client", () => {
      const scope = createScope({
        partnerIds: ["partner-1", "partner-2"],
        partnerAdminIds: ["partner-1", "partner-2"],
      });

      expect(() => getPreferredPartnerIdForClientCreation(scope)).toThrow(
        "Select an active partner context before creating a client."
      );
      expect(() => getPreferredPartnerIdForReportTemplateCreation(scope)).toThrow(
        "Select an active partner context before creating a report template."
      );
    });
  });

  describe("partner admin with zero clients", () => {
    it("returns empty access with no errors", () => {
      const scope = createScope({
        partnerIds: ["partner-a"],
        partnerAdminIds: ["partner-a"],
        clientIds: [],
      });

      expect(canAccessClient(scope, "client-a1")).toBe(false);
      expect(canManageClientDirectory(scope)).toBe(true); // can manage directory (create new)
    });
  });

  // =============================================================================
  // Client Admin — Cross-Client Isolation
  // =============================================================================

  describe("client admin", () => {
    const clientA1Scope = createScope({
      clientIds: ["client-a1"],
      clientAdminIds: ["client-a1"],
    });

    it("can access their own client", () => {
      expect(canAccessClient(clientA1Scope, "client-a1")).toBe(true);
    });

    it("cannot access other clients", () => {
      expect(canAccessClient(clientA1Scope, "client-a2")).toBe(false);
      expect(canAccessClient(clientA1Scope, "client-b1")).toBe(false);
    });

    it("can manage their own client", () => {
      expect(canManageClient(clientA1Scope, "client-a1", null)).toBe(true);
    });

    it("can manage campaigns for their own client", () => {
      expect(canManageCampaign(clientA1Scope, null, "client-a1")).toBe(true);
    });

    it("cannot manage other clients", () => {
      expect(canManageClient(clientA1Scope, "client-a2", null)).toBe(false);
      expect(canManageClient(clientA1Scope, "client-b1", "partner-b")).toBe(false);
    });

    it("cannot manage client directory or assignments", () => {
      expect(canManageClientDirectory(clientA1Scope)).toBe(false);
      expect(canManageClientAssignment(clientA1Scope)).toBe(false);
    });

    it("cannot access any partner", () => {
      expect(canAccessPartner(clientA1Scope, "partner-a")).toBe(false);
      expect(canManagePartnerDirectory(clientA1Scope)).toBe(false);
    });
  });

  describe("client member (non-admin)", () => {
    const memberScope = createScope({
      clientIds: ["client-a1"],
      clientAdminIds: [], // NOT an admin
    });

    it("can access their own client", () => {
      expect(canAccessClient(memberScope, "client-a1")).toBe(true);
    });

    it("cannot manage their own client", () => {
      expect(canManageClient(memberScope, "client-a1", null)).toBe(false);
    });
  });

  // =============================================================================
  // Support Sessions
  // =============================================================================

  describe("support session scoping", () => {
    it("restricts scope to target tenant only", () => {
      // A support session for client-a1 should restrict clientIds to just [client-a1]
      const scope = createScope({
        isPlatformAdmin: false, // on client surface
        requestSurface: "client",
        clientIds: ["client-a1"], // support session restricts to this
        clientAdminIds: ["client-a1"],
        supportSession: {
          id: "session-1",
          actorProfileId: "admin-1",
          targetSurface: "client",
          targetTenantId: "client-a1",
          reason: "Admin portal access",
          sessionKey: "test-key",
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
          endedAt: null,
          metadata: {},
        },
      });

      expect(canAccessClient(scope, "client-a1")).toBe(true);
      expect(canAccessClient(scope, "client-a2")).toBe(false);
      expect(canAccessClient(scope, "client-b1")).toBe(false);
    });
  });

  // =============================================================================
  // No Access (unauthenticated / empty scope)
  // =============================================================================

  describe("empty scope (no memberships)", () => {
    const emptyScope = createScope({});

    it("cannot access any client", () => {
      expect(canAccessClient(emptyScope, "client-1")).toBe(false);
    });

    it("cannot manage any client", () => {
      expect(canManageClient(emptyScope, "client-1", null)).toBe(false);
      expect(canManageClient(emptyScope, "client-1", "partner-1")).toBe(false);
    });

    it("cannot access any partner", () => {
      expect(canAccessPartner(emptyScope, "partner-1")).toBe(false);
    });

    it("cannot manage directories", () => {
      expect(canManageClientDirectory(emptyScope)).toBe(false);
      expect(canManagePartnerDirectory(emptyScope)).toBe(false);
      expect(canManageClientAssignment(emptyScope)).toBe(false);
      expect(canManageCampaign(emptyScope, "partner-1", "client-1")).toBe(false);
      expect(canManageReportTemplateLibrary(emptyScope)).toBe(false);
    });

    it("fails admin-only check", () => {
      expect(() => assertAdminOnly(emptyScope)).toThrow(AuthorizationError);
    });
  });
});

// =============================================================================
// Workspace tenant filter
// =============================================================================

describe("resolveTenantClientFilter", () => {
  it("is unrestricted only for a platform admin with no workspace selected", () => {
    expect(resolveTenantClientFilter(createScope({ isPlatformAdmin: true }))).toBeNull();
  });

  it("confines a platform admin who has entered a client workspace", () => {
    // The regression this guards: RLS cannot see the active context, so a
    // platform admin inside one client's portal was served every tenant's rows.
    const scope = createScope({
      isPlatformAdmin: true,
      activeContext: { surface: "client", tenantType: "client", tenantId: "client-1" },
      clientIds: ["client-1"],
    });

    expect(resolveTenantClientFilter(scope)).toEqual(["client-1"]);
  });

  it("confines a platform admin inside a support session", () => {
    const scope = createScope({
      requestSurface: "client",
      clientIds: ["client-1"],
      supportSession: {
        id: "support-1",
        actorProfileId: "actor-1",
        targetSurface: "client",
        targetTenantId: "client-1",
        reason: "Admin portal access",
        sessionKey: "session-key-1",
        createdAt: "2026-01-01T00:00:00.000Z",
        expiresAt: "2099-01-01T00:00:00.000Z",
        metadata: {},
      },
    });

    expect(resolveTenantClientFilter(scope)).toEqual(["client-1"]);
  });

  it("restricts an ordinary member to their memberships", () => {
    expect(
      resolveTenantClientFilter(createScope({ clientIds: ["client-1", "client-2"] }))
    ).toEqual(["client-1", "client-2"]);
  });

  it("returns an empty list — not null — when the caller reaches no client", () => {
    // Callers must read this as "no rows", never as "unrestricted".
    expect(resolveTenantClientFilter(createScope())).toEqual([]);
  });
});

// =============================================================================
// applyTenantClientFilter
//
// The empty-list case is the one that matters: "restricted to nothing" read as
// "unrestricted" is exactly the mistake that leaked one client's participants
// to every other. Returning null forces the caller to handle it.
// =============================================================================

describe("applyTenantClientFilter", () => {
  /** Minimal stand-in for a PostgREST filter builder. */
  function createQuery() {
    const calls: Array<{ column: string; values: string[] }> = [];
    const query = {
      calls,
      in(column: string, values: string[]) {
        calls.push({ column, values });
        return query;
      },
    };
    return query;
  }

  it("leaves the query untouched when the caller is unrestricted", () => {
    const query = createQuery();
    const scoped = applyTenantClientFilter(
      query,
      createScope({ isPlatformAdmin: true }),
      "client_id"
    );

    expect(scoped).toBe(query);
    expect(query.calls).toEqual([]);
  });

  it("applies the workspace client ids as an explicit predicate", () => {
    const query = createQuery();
    const scoped = applyTenantClientFilter(
      query,
      createScope({
        isPlatformAdmin: true,
        activeContext: { surface: "client", tenantType: "client", tenantId: "client-1" },
        clientIds: ["client-1"],
      }),
      "campaigns.client_id"
    );

    expect(scoped).toBe(query);
    expect(query.calls).toEqual([
      { column: "campaigns.client_id", values: ["client-1"] },
    ]);
  });

  it("returns null — never an unfiltered query — when confined to nothing", () => {
    const query = createQuery();

    expect(applyTenantClientFilter(query, createScope(), "client_id")).toBeNull();
    expect(query.calls).toEqual([]);
  });
});
