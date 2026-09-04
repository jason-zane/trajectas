import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const queryBuilder = vi.hoisted(() => {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const m of ["select", "eq", "single"]) {
    builder[m] = vi.fn();
  }
  return builder;
});

const supabase = vi.hoisted(() => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn(() => queryBuilder),
  })),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: supabase.createAdminClient,
}));

import { assertCanEditClientBrand } from "@/lib/brand/brand-write-authorization";
import type { AuthorizedScope } from "@/lib/auth/authorization";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CLIENT = "11111111-1111-1111-1111-111111111111";
const PARTNER = "99999999-9999-9999-9999-999999999999";

function scope(overrides: Partial<AuthorizedScope> = {}): AuthorizedScope {
  return {
    actor: null,
    activeContext: null,
    previewContext: null,
    requestSurface: "partner",
    isPlatformAdmin: false,
    isLocalDevelopmentBypass: false,
    partnerIds: [],
    partnerAdminIds: [],
    clientIds: [CLIENT],
    clientAdminIds: [],
    managedClientIds: [CLIENT],
    isLocalDevelopment: false,
    supportSession: null,
    ...overrides,
  };
}

/** Queue the `clients` row, then (optionally) the `partners` row. */
function queueRows(client: { can_customize_branding: boolean; partner_id: string | null }, partner?: { can_customize_branding: boolean }) {
  queryBuilder.single.mockResolvedValueOnce({ data: client, error: null });
  if (partner) {
    queryBuilder.single.mockResolvedValueOnce({ data: partner, error: null });
  }
}

describe("assertCanEditClientBrand (D5)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const m of Object.keys(queryBuilder)) {
      queryBuilder[m].mockReturnValue(queryBuilder);
    }
  });

  it("platform admins pass without touching the database", async () => {
    await expect(
      assertCanEditClientBrand(scope({ isPlatformAdmin: true }), CLIENT)
    ).resolves.toBeUndefined();
    expect(supabase.createAdminClient).not.toHaveBeenCalled();
  });

  it("a partner admin passes while the partner flag is on, whatever the client flag says", async () => {
    queueRows({ can_customize_branding: false, partner_id: PARTNER }, { can_customize_branding: true });
    await expect(
      assertCanEditClientBrand(scope({ partnerAdminIds: [PARTNER] }), CLIENT)
    ).resolves.toBeUndefined();
  });

  it("a partner admin is refused while the partner flag is off", async () => {
    queueRows({ can_customize_branding: true, partner_id: PARTNER }, { can_customize_branding: false });
    await expect(
      assertCanEditClientBrand(scope({ partnerAdminIds: [PARTNER] }), CLIENT)
    ).rejects.toThrow(/not enabled for your partner/i);
  });

  it("a client admin passes when both flags are on", async () => {
    queueRows({ can_customize_branding: true, partner_id: PARTNER }, { can_customize_branding: true });
    await expect(
      assertCanEditClientBrand(scope({ clientAdminIds: [CLIENT] }), CLIENT)
    ).resolves.toBeUndefined();
  });

  it("a client admin is refused when the client flag is off", async () => {
    queueRows({ can_customize_branding: false, partner_id: PARTNER }, { can_customize_branding: true });
    await expect(
      assertCanEditClientBrand(scope({ clientAdminIds: [CLIENT] }), CLIENT)
    ).rejects.toThrow(/not enabled for this client/i);
  });

  it("a client admin is refused when the partner flag is off even if the client flag is on", async () => {
    queueRows({ can_customize_branding: true, partner_id: PARTNER }, { can_customize_branding: false });
    await expect(
      assertCanEditClientBrand(scope({ clientAdminIds: [CLIENT] }), CLIENT)
    ).rejects.toThrow(/not enabled for this client/i);
  });

  it("a platform-owned client's admin needs only the client flag", async () => {
    queueRows({ can_customize_branding: true, partner_id: null });
    await expect(
      assertCanEditClientBrand(scope({ clientAdminIds: [CLIENT] }), CLIENT)
    ).resolves.toBeUndefined();
  });
});
