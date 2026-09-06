import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ResolvedActor } from "@/lib/auth/types";

const mock = vi.hoisted(() => {
  type Row = Record<string, unknown>;
  const state = {
    actor: null as unknown,
    host: "partner.trajectas.com",
    tables: {} as Record<string, Row[]>,
    ops: [] as { table: string; method: string; args: unknown[] }[],
  };
  function from(table: string) {
    let rows = [...(state.tables[table] ?? [])];
    let one = false;
    const query: Record<string, unknown> = {};
    for (const method of ["select", "eq", "in", "is", "or", "gt", "single", "maybeSingle"]) {
      query[method] = (...args: unknown[]) => {
        state.ops.push({ table, method, args });
        if (method === "single" || method === "maybeSingle") one = true;
        if (method === "eq" || method === "is") rows = rows.filter((row) => row[String(args[0])] === args[1]);
        if (method === "in") rows = rows.filter((row) => (args[1] as unknown[]).includes(row[String(args[0])]));
        return query;
      };
    }
    query.then = (resolve: (result: unknown) => unknown) => Promise.resolve({ data: one ? rows[0] ?? null : rows, error: null }).then(resolve);
    return query;
  }
  return { state, from };
});
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: mock.from }) }));
vi.mock("@/lib/auth/actor", () => ({
  resolveSessionActor: async () => mock.state.actor,
  resolveSignedPreviewContext: async () => null,
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ host: mock.state.host }) }));

import {
  AuthorizationError,
  canAccessCampaign,
  canManageCampaign,
  getAccessibleCampaignIds,
  requireCampaignAccess,
  requireCampaignManage,
  requireClientAccess,
  requireReportSnapshotAccess,
  resolveAuthorizedScope,
  type AuthorizedScope,
} from "@/lib/auth/authorization";

const transferred = "client-transferred";
const retained = "client-retained";
function actor(partnerId: string, role: "admin" | "member" = "admin"): ResolvedActor {
  return {
    id: "actor", email: "actor@example.invalid", role: "consultant", isActive: true,
    partnerMemberships: [{ id: "pm", partnerId, role, isDefault: true, createdAt: "2026-01-01" }],
    clientMemberships: [], activeContext: null,
  };
}
function useActor(value: ResolvedActor) { mock.state.actor = value; }

beforeEach(() => {
  vi.stubEnv("ADMIN_APP_URL", "https://admin.trajectas.com");
  vi.stubEnv("PARTNER_APP_URL", "https://partner.trajectas.com");
  mock.state.ops = [];
  mock.state.host = "partner.trajectas.com";
  useActor(actor("partner-old"));
  mock.state.tables = {
    clients: [
      { id: transferred, partner_id: "partner-new", deleted_at: null },
      { id: retained, partner_id: "partner-old", deleted_at: null },
    ],
    campaigns: [{
      id: "campaign", client_id: transferred, partner_id: "partner-old",
      deleted_at: null, confidentiality_mode: "standard",
      clients: { partner_id: "partner-new", deleted_at: null },
    }],
    report_snapshots: [{
      id: "report", campaign_id: "campaign", participant_session_id: "session",
      campaigns: { client_id: transferred, partner_id: "partner-old", confidentiality_mode: "standard", clients: { partner_id: "partner-new", deleted_at: null } },
      participant_sessions: { campaign_participant_id: "participant" },
    }],
  };
});

describe("canonical campaign ownership", () => {
  it("denies the previous partner campaign reads, management and individual report access", async () => {
    const scope = await resolveAuthorizedScope();
    expect(scope.clientIds).toEqual([retained]);
    expect(canAccessCampaign(scope, "partner-old", transferred)).toBe(false);
    expect(canManageCampaign(scope, "partner-old", transferred)).toBe(false);
    await expect(requireCampaignAccess("campaign")).rejects.toBeInstanceOf(AuthorizationError);
    await expect(requireCampaignManage("campaign")).rejects.toBeInstanceOf(AuthorizationError);
    await expect(requireReportSnapshotAccess("report")).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("admits the current partner and returns current ownership despite stale copied fields", async () => {
    useActor(actor("partner-new"));
    await expect(requireCampaignManage("campaign")).resolves.toMatchObject({ clientId: transferred, partnerId: "partner-new" });
    await expect(requireReportSnapshotAccess("report")).resolves.toMatchObject({ clientId: transferred, partnerId: "partner-new" });
  });

  it.each(["admin", "member"] as const)("preserves explicit client %s membership after partner transfer", async (role) => {
    const value = actor("partner-old");
    value.clientMemberships = [{ id: "cm", clientId: transferred, role, isDefault: false, createdAt: "2026-01-01" }];
    useActor(value);
    const scope = await resolveAuthorizedScope();
    expect(canAccessCampaign(scope, "partner-old", transferred)).toBe(true);
    expect(canManageCampaign(scope, "partner-old", transferred)).toBe(role === "admin");
    await expect(requireCampaignAccess("campaign")).resolves.toMatchObject({ partnerId: "partner-new" });
  });

  it("permits current partner members to read but not manage", async () => {
    useActor(actor("partner-new", "member"));
    await expect(requireCampaignAccess("campaign")).resolves.toMatchObject({ clientId: transferred });
    await expect(requireCampaignManage("campaign")).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("keeps standalone partner campaigns accessible and manageable", async () => {
    mock.state.tables.campaigns[0] = { id: "campaign", client_id: null, partner_id: "partner-old", deleted_at: null };
    await expect(requireCampaignManage("campaign")).resolves.toMatchObject({ clientId: null, partnerId: "partner-old" });
  });

  it("does not use stale partner authority when the owning client was archived", async () => {
    useActor(actor("partner-new"));
    mock.state.tables.campaigns[0].clients = { partner_id: "partner-new", deleted_at: "2026-01-01" };
    await expect(requireCampaignAccess("campaign")).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("confines direct client and campaign lookups to the selected client workspace", async () => {
    mock.state.tables.clients.push({ id: "sibling", partner_id: "partner-old", deleted_at: null });
    const value = actor("partner-old");
    value.activeContext = { surface: "client", tenantType: "client", tenantId: retained };
    useActor(value);
    await expect(requireClientAccess(retained)).resolves.toMatchObject({ clientId: retained });
    await expect(requireClientAccess("sibling")).rejects.toBeInstanceOf(AuthorizationError);
    const scope = await resolveAuthorizedScope();
    expect(scope.partnerIds).toEqual(["partner-old"]);
    expect(canAccessCampaign(scope, "partner-old", "sibling")).toBe(false);
    expect(canManageCampaign(scope, "partner-old", "sibling")).toBe(false);
    expect(canAccessCampaign(scope, "partner-old", null)).toBe(false);
  });

  it("limits the partner predicate to standalone campaigns in list queries", async () => {
    await getAccessibleCampaignIds(await resolveAuthorizedScope());
    expect(mock.state.ops).toContainEqual({ table: "campaigns", method: "or", args: [`client_id.in.(${retained}),and(client_id.is.null,partner_id.in.(partner-old))`] });
  });

  it("requires a null client for a partner with no current clients", async () => {
    mock.state.tables.clients = [];
    await getAccessibleCampaignIds(await resolveAuthorizedScope());
    expect(mock.state.ops).toContainEqual({ table: "campaigns", method: "is", args: ["client_id", null] });
  });

  it("does not include standalone partner campaigns in a selected client workspace", async () => {
    const value = actor("partner-old");
    value.activeContext = { surface: "client", tenantType: "client", tenantId: retained };
    useActor(value);
    await getAccessibleCampaignIds(await resolveAuthorizedScope());
    expect(mock.state.ops.filter((op) => op.table === "campaigns" && op.method === "or")).toEqual([]);
    expect(mock.state.ops).toContainEqual({ table: "campaigns", method: "in", args: ["client_id", [retained]] });
  });

  it("confines platform admins inside a client workspace while retaining unrestricted administration", async () => {
    const scope = await resolveAuthorizedScope();
    const scoped: AuthorizedScope = { ...scope, isPlatformAdmin: true, clientIds: [retained], managedClientIds: [retained], activeContext: { surface: "client", tenantType: "client", tenantId: retained } };
    expect(canAccessCampaign(scoped, "partner-old", transferred)).toBe(false);
    expect(canManageCampaign(scoped, "partner-old", transferred)).toBe(false);
    expect(canManageCampaign(scoped, "partner-old", retained)).toBe(true);
    expect(canManageCampaign({ ...scoped, activeContext: null }, "partner-new", transferred)).toBe(true);
  });
  it("confines a real platform-admin support session even on the admin host", async () => {
    mock.state.host = "admin.trajectas.com";
    const value = actor("partner-old");
    value.role = "platform_admin";
    value.partnerMemberships = [];
    value.activeContext = { surface: "client", tenantType: "client", tenantId: retained, supportSessionId: "support" };
    mock.state.tables.support_sessions = [{ id: "support", actor_profile_id: "actor", target_surface: "client", client_id: retained, partner_id: null, reason: "Local unit regression", session_key: "key", created_at: "2026-01-01", expires_at: "2099-01-01", ended_at: null }];
    useActor(value);
    const resolved = await resolveAuthorizedScope();
    expect(resolved.isPlatformAdmin).toBe(true);
    expect(resolved.supportSession?.id).toBe("support");
    expect(resolved.clientIds).toEqual([retained]);
    expect(resolved.managedClientIds).toEqual([retained]);
    await expect(requireClientAccess(retained)).resolves.toMatchObject({ clientId: retained });
    await expect(requireClientAccess(transferred)).rejects.toBeInstanceOf(AuthorizationError);
    await expect(requireCampaignAccess("campaign")).rejects.toBeInstanceOf(AuthorizationError);
    await expect(requireReportSnapshotAccess("report")).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("resolves managed clients for a platform admin's selected workspace without granting others", async () => {
    mock.state.host = "admin.trajectas.com";
    const value = actor("partner-old");
    value.role = "platform_admin";
    value.partnerMemberships = [];
    value.activeContext = { surface: "client", tenantType: "client", tenantId: retained };
    useActor(value);
    const resolved = await resolveAuthorizedScope();
    expect(resolved.isPlatformAdmin).toBe(true);
    expect(resolved.managedClientIds).toEqual([retained]);
    expect(canManageCampaign(resolved, "partner-old", retained)).toBe(true);
    expect(canManageCampaign(resolved, "partner-old", transferred)).toBe(false);
  });

});
