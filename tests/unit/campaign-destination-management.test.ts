import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthorizedScope } from "@/lib/auth/authorization";

const mocks = vi.hoisted(() => ({ scope: vi.fn(), manage: vi.fn(), insert: vi.fn(), update: vi.fn(), audit: vi.fn() }));
const client = "11111111-1111-4111-8111-111111111111";
const target = "22222222-2222-4222-8222-222222222222";
const partner = "33333333-3333-4333-8333-333333333333";
const campaign = "44444444-4444-4444-8444-444444444444";
vi.mock("@/lib/auth/authorization", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/auth/authorization")>(),
  resolveAuthorizedScope: mocks.scope,
  requireCampaignManage: mocks.manage,
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({
  from: (table: string) => {
    const query: Record<string, unknown> = {};
    for (const method of ["select", "eq", "is", "single"]) query[method] = () => query;
    query.insert = (row: unknown) => { mocks.insert(table, row); return query; };
    query.update = (row: unknown) => { mocks.update(table, row); return query; };
    query.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data: table === "clients" ? { id: client, partner_id: partner } : { id: campaign }, error: null }).then(resolve);
    return query;
  },
}) }));
vi.mock("@/lib/auth/support-sessions", () => ({ logAuditEvent: mocks.audit }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

import { createCampaign, updateCampaign } from "@/app/actions/campaigns";
function scope(overrides: Partial<AuthorizedScope> = {}): AuthorizedScope {
  return {
    actor: null, activeContext: null, previewContext: null, requestSurface: "client",
    isPlatformAdmin: false, isLocalDevelopmentBypass: false, isLocalDevelopment: false,
    partnerIds: [], partnerAdminIds: [], clientIds: [client], clientAdminIds: [], managedClientIds: [], supportSession: null,
    ...overrides,
  };
}
const payload = (clientId = client) => ({ title: "Test campaign", slug: "test-campaign", clientId });
beforeEach(() => {
  mocks.scope.mockResolvedValue(scope());
  mocks.manage.mockResolvedValue({ scope: scope({ managedClientIds: [client] }), campaignId: campaign, clientId: client, partnerId: partner });
});

describe("campaign destination management", () => {
  it.each(["client", "partner"])("denies creation by an ordinary %s member before any write", async (membership) => {
    mocks.scope.mockResolvedValue(scope({ partnerIds: membership === "partner" ? [partner] : [] }));
    expect(await createCampaign(payload())).toMatchObject({ error: { clientId: [expect.stringMatching(/permission to manage/)] } });
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it.each(["client", "partner"])("allows creation by the current %s admin", async (membership) => {
    mocks.scope.mockResolvedValue(scope({ managedClientIds: [client], clientAdminIds: membership === "client" ? [client] : [], partnerAdminIds: membership === "partner" ? [partner] : [] }));
    expect(await createCampaign(payload())).toEqual({ success: true, id: campaign });
    expect(mocks.insert).toHaveBeenCalledWith("campaigns", expect.objectContaining({ client_id: client, partner_id: partner }));
  });

  it("denies moving a managed campaign into a client the actor can only read", async () => {
    mocks.manage.mockResolvedValue({ scope: scope({ clientIds: [client, target], managedClientIds: [client] }), clientId: client, partnerId: partner });
    expect(await updateCampaign(campaign, payload(target))).toMatchObject({ error: { clientId: [expect.stringMatching(/permission to manage/)] } });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("allows moving a campaign when the actor manages both clients", async () => {
    mocks.manage.mockResolvedValue({ scope: scope({ clientIds: [client, target], managedClientIds: [client, target] }), clientId: client, partnerId: partner });
    expect(await updateCampaign(campaign, payload(target))).toEqual({ success: true, id: campaign });
    expect(mocks.update).toHaveBeenCalledWith("campaigns", expect.objectContaining({ client_id: target, partner_id: partner }));
  });
  it("confines a scoped platform admin to the selected client for creation and reassignment", async () => {
    const confined = scope({ isPlatformAdmin: true, managedClientIds: [client], activeContext: { surface: "client", tenantType: "client", tenantId: client } });
    mocks.scope.mockResolvedValue(confined);
    mocks.manage.mockResolvedValue({ scope: confined, clientId: client, partnerId: partner });
    expect(await createCampaign(payload(target))).toHaveProperty("error");
    expect(await updateCampaign(campaign, payload(target))).toHaveProperty("error");
    expect(await createCampaign({ title: "Outside workspace", slug: "outside-workspace" })).toHaveProperty("error");
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
    expect(await createCampaign(payload())).toEqual({ success: true, id: campaign });
  });

  it("preserves unrestricted platform creation", async () => {
    mocks.scope.mockResolvedValue(scope({ isPlatformAdmin: true, clientIds: [], managedClientIds: [] }));
    expect(await createCampaign(payload(target))).toEqual({ success: true, id: campaign });
    expect(await createCampaign({ title: "Standalone", slug: "standalone" })).toEqual({ success: true, id: campaign });
  });

});
