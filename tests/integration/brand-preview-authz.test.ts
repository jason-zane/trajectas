import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Authorization pins for getClientBrandForPreview.
 *
 * The "Preview as <client>" selector in the experience editor reads a client's
 * effective brand via this action. It used to gate on requireAdminScope(),
 * which throws for client/partner org-admins (who, on the single-host model,
 * are never platform_admin). This is the same recurring bug that bit campaign
 * branding (#311) and experience (#318): a client-scoped action reachable from
 * tenant editors must gate on authority over the CLIENT, not platform-admin.
 *
 * These pins fail if the gate reverts to platform-admin-only, or is removed.
 */

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const supabaseMocks = vi.hoisted(() => {
  const singleFn = vi.fn();
  const chain = {
    eq: vi.fn(),
    is: vi.fn(),
    single: singleFn,
  };
  chain.eq.mockReturnValue(chain);
  chain.is.mockReturnValue(chain);
  const selectFn = vi.fn().mockReturnValue(chain);
  const fromFn = vi.fn().mockReturnValue({ select: selectFn });
  return { fromFn, selectFn, chain, singleFn };
});

const authzMocks = vi.hoisted(() => ({
  resolveAuthorizedScope: vi.fn(),
}));

const mergeMocks = vi.hoisted(() => ({
  mergeBrandLayers: vi.fn(),
  isEmptyOverrides: vi.fn(() => false),
}));

const cacheMocks = vi.hoisted(() => ({
  unstable_cache:
    <T extends (...args: unknown[]) => unknown>(fn: T): T => fn,
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

// ---------------------------------------------------------------------------
// vi.mock registrations (before SUT import)
// ---------------------------------------------------------------------------

vi.mock("next/cache", () => ({
  unstable_cache: cacheMocks.unstable_cache,
  revalidatePath: cacheMocks.revalidatePath,
  revalidateTag: cacheMocks.revalidateTag,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: supabaseMocks.fromFn }),
}));

vi.mock("@/lib/auth/support-sessions", () => ({
  logAuditEvent: vi.fn(),
}));

// Mock only scope RESOLUTION; re-implement the pure gate helpers inline
// (mirroring src/lib/auth/authorization.ts) so the action's authorization
// wiring is genuinely exercised against scope fixtures.
vi.mock("@/lib/auth/authorization", () => {
  class AuthorizationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "AuthorizationError";
    }
  }
  interface ScopeLike {
    isPlatformAdmin: boolean;
    clientAdminIds: string[];
    partnerAdminIds: string[];
  }
  return {
    AuthorizationError,
    resolveAuthorizedScope: authzMocks.resolveAuthorizedScope,
    assertAdminOnly: (scope: ScopeLike) => {
      if (!scope.isPlatformAdmin) {
        throw new AuthorizationError("This action is restricted to platform admin.");
      }
    },
    canManageClient: (
      scope: ScopeLike,
      clientId: string,
      clientPartnerId?: string | null,
    ) =>
      scope.isPlatformAdmin ||
      scope.clientAdminIds.includes(clientId) ||
      (clientPartnerId != null && scope.partnerAdminIds.includes(clientPartnerId)),
    canManagePartner: (scope: ScopeLike, partnerId: string) =>
      scope.isPlatformAdmin || scope.partnerAdminIds.includes(partnerId),
    canManageCampaign: (
      scope: ScopeLike,
      campaignPartnerId?: string | null,
      campaignClientId?: string | null,
    ) =>
      scope.isPlatformAdmin ||
      (campaignPartnerId != null && scope.partnerAdminIds.includes(campaignPartnerId)) ||
      (campaignClientId != null && scope.clientAdminIds.includes(campaignClientId)),
  };
});

vi.mock("@/lib/brand/merge", () => ({
  mergeBrandLayers: mergeMocks.mergeBrandLayers,
  isEmptyOverrides: mergeMocks.isEmptyOverrides,
}));

// ---------------------------------------------------------------------------
// SUT import (after mocks)
// ---------------------------------------------------------------------------

import { getClientBrandForPreview } from "@/app/actions/brand";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CLIENT_A = "11111111-1111-4111-8111-111111111111";
const CLIENT_B = "22222222-2222-4222-8222-222222222222";

const PLATFORM_ADMIN_SCOPE = {
  isPlatformAdmin: true,
  clientAdminIds: [] as string[],
  partnerAdminIds: [] as string[],
};

const CLIENT_A_ADMIN_SCOPE = {
  isPlatformAdmin: false,
  clientAdminIds: [CLIENT_A],
  partnerAdminIds: [] as string[],
};

const UNRELATED_MEMBER_SCOPE = {
  isPlatformAdmin: false,
  clientAdminIds: [] as string[],
  partnerAdminIds: [] as string[],
};

const STUB_BRAND = { name: "Stub", primaryColor: "#123456" };

describe("getClientBrandForPreview authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Re-apply chain after clearAllMocks resets return values.
    supabaseMocks.chain.eq.mockReturnValue(supabaseMocks.chain);
    supabaseMocks.chain.is.mockReturnValue(supabaseMocks.chain);
    supabaseMocks.selectFn.mockReturnValue(supabaseMocks.chain);
    supabaseMocks.fromFn.mockReturnValue({ select: supabaseMocks.selectFn });
    // Every brand/client lookup returns "no row" so getEffectiveBrand never
    // touches mapBrandConfigRow; the merged result comes from the mock below.
    supabaseMocks.singleFn.mockResolvedValue({ data: null, error: { message: "none" } });

    mergeMocks.mergeBrandLayers.mockReturnValue(STUB_BRAND);
  });

  it("allows a platform admin (no regression to the admin preview flow)", async () => {
    authzMocks.resolveAuthorizedScope.mockResolvedValue(PLATFORM_ADMIN_SCOPE);

    await expect(getClientBrandForPreview(CLIENT_A)).resolves.toEqual(STUB_BRAND);
  });

  it("allows an org-admin of the client — the bug this fix closes", async () => {
    authzMocks.resolveAuthorizedScope.mockResolvedValue(CLIENT_A_ADMIN_SCOPE);

    // Must NOT throw "restricted to platform admin".
    await expect(getClientBrandForPreview(CLIENT_A)).resolves.toEqual(STUB_BRAND);
  });

  it("rejects an org-admin previewing a client they do not manage", async () => {
    authzMocks.resolveAuthorizedScope.mockResolvedValue(CLIENT_A_ADMIN_SCOPE);

    await expect(getClientBrandForPreview(CLIENT_B)).rejects.toThrow(/not authorized/i);
    // Gate must short-circuit before any brand lookup.
    expect(supabaseMocks.fromFn).not.toHaveBeenCalled();
  });

  it("rejects an authenticated non-admin (mere membership is not enough)", async () => {
    authzMocks.resolveAuthorizedScope.mockResolvedValue(UNRELATED_MEMBER_SCOPE);

    await expect(getClientBrandForPreview(CLIENT_A)).rejects.toThrow(/not authorized/i);
    expect(supabaseMocks.fromFn).not.toHaveBeenCalled();
  });
});
