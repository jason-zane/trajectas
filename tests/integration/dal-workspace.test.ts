import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { canRun, createAdminClient } from "./_helpers/rls-fixture";
import { getSidebarIdentity } from "@/lib/dal/workspace";
import type { WorkspaceBootstrap } from "@/lib/auth/types";

const ts = Date.now();
const slug = (s: string) => `dalws-${s}-${ts}`.toLowerCase();

/**
 * Validates the getSidebarIdentity query (clients/partners read, brand_configs
 * read) against the live local schema. The function maps workspace context
 * options into sidebar branding (tenant name, logo, platform name, logo).
 * Unit-test the mapping logic separately if needed; here we validate the
 * queries resolve and join correctly.
 */
describe.skipIf(!canRun)("dal/workspace: getSidebarIdentity", () => {
  const admin = createAdminClient();
  const ids = {
    client: "",
    partner: "",
  };

  beforeAll(async () => {
    const { data: c, error: cErr } = await admin
      .from("clients")
      .insert({ name: `DAL WS Client ${ts}`, slug: slug("client") })
      .select("id")
      .single();
    if (cErr) throw new Error(`client insert: ${cErr.message}`);
    ids.client = c!.id;

    const { data: p, error: pErr } = await admin
      .from("partners")
      .insert({ name: `DAL WS Partner ${ts}`, slug: slug("partner") })
      .select("id")
      .single();
    if (pErr) throw new Error(`partner insert: ${pErr.message}`);
    ids.partner = p!.id;
  });

  afterAll(async () => {
    await admin.from("clients").delete().eq("id", ids.client);
    await admin.from("partners").delete().eq("id", ids.partner);
  });

  it("returns empty identity when bootstrap portal is admin", async () => {
    const bootstrap: Partial<WorkspaceBootstrap> = {
      portal: "admin",
      workspaceContextOptions: [],
    };

    // Mock getCachedPlatformBrand to avoid cache lookups
    vi.doMock("@/app/actions/brand", async (importOriginal) => {
      const actual = await importOriginal<typeof import("@/app/actions/brand")>();
      return {
        ...actual,
        getCachedPlatformBrand: vi.fn().mockResolvedValue(null),
      };
    });

    try {
      const result = await getSidebarIdentity(bootstrap as WorkspaceBootstrap);
      expect(result.tenantName).toBeNull();
      expect(result.tenantLogomarkUrl).toBeNull();
      expect(result.platformName).toBe("Trajectas");
      expect(result.platformLogomarkUrl).toBeNull();
    } finally {
      vi.doUnmock("@/app/actions/brand");
    }
  });

  it("returns empty identity when no workspace context options available", async () => {
    const bootstrap: Partial<WorkspaceBootstrap> = {
      portal: "client",
      workspaceContextOptions: [],
    };

    vi.doMock("@/app/actions/brand", async (importOriginal) => {
      const actual = await importOriginal<typeof import("@/app/actions/brand")>();
      return {
        ...actual,
        getCachedPlatformBrand: vi.fn().mockResolvedValue(null),
      };
    });

    try {
      const result = await getSidebarIdentity(bootstrap as WorkspaceBootstrap);
      expect(result.tenantName).toBeNull();
      expect(result.tenantLogomarkUrl).toBeNull();
    } finally {
      vi.doUnmock("@/app/actions/brand");
    }
  });

  it("returns tenant identity when selected context option has valid tenantId and type", async () => {
    const bootstrap: Partial<WorkspaceBootstrap> = {
      portal: "client",
      workspaceContextOptions: [
        {
          key: "client-opt",
          label: "Fallback Label",
          description: "Test",
          selected: true,
          tenantId: ids.client,
          tenantType: "client",
          kind: "client",
        },
      ],
    };

    vi.doMock("@/app/actions/brand", async (importOriginal) => {
      const actual = await importOriginal<typeof import("@/app/actions/brand")>();
      return {
        ...actual,
        getCachedPlatformBrand: vi.fn().mockResolvedValue(null),
      };
    });

    try {
      const result = await getSidebarIdentity(bootstrap as WorkspaceBootstrap);
      expect(result.tenantName).toBe(`DAL WS Client ${ts}`);
      expect(result.platformName).toBe("Trajectas");
    } finally {
      vi.doUnmock("@/app/actions/brand");
    }
  });

  it("uses label as fallback when tenant name query returns no data", async () => {
    const nonexistentId = "00000000-0000-0000-0000-000000000000";
    const fallbackLabel = "My Custom Workspace";
    const bootstrap: Partial<WorkspaceBootstrap> = {
      portal: "client",
      workspaceContextOptions: [
        {
          key: "unknown-opt",
          label: fallbackLabel,
          description: "Test",
          selected: true,
          tenantId: nonexistentId,
          tenantType: "client",
          kind: "client",
        },
      ],
    };

    vi.doMock("@/app/actions/brand", async (importOriginal) => {
      const actual = await importOriginal<typeof import("@/app/actions/brand")>();
      return {
        ...actual,
        getCachedPlatformBrand: vi.fn().mockResolvedValue(null),
      };
    });

    try {
      const result = await getSidebarIdentity(bootstrap as WorkspaceBootstrap);
      expect(result.tenantName).toBe(fallbackLabel);
    } finally {
      vi.doUnmock("@/app/actions/brand");
    }
  });

  it("queries partner table when tenantType is partner", async () => {
    const bootstrap: Partial<WorkspaceBootstrap> = {
      portal: "partner",
      workspaceContextOptions: [
        {
          key: "partner-opt",
          label: "Fallback",
          description: "Test",
          selected: true,
          tenantId: ids.partner,
          tenantType: "partner",
          kind: "partner",
        },
      ],
    };

    vi.doMock("@/app/actions/brand", async (importOriginal) => {
      const actual = await importOriginal<typeof import("@/app/actions/brand")>();
      return {
        ...actual,
        getCachedPlatformBrand: vi.fn().mockResolvedValue(null),
      };
    });

    try {
      const result = await getSidebarIdentity(bootstrap as WorkspaceBootstrap);
      expect(result.tenantName).toBe(`DAL WS Partner ${ts}`);
    } finally {
      vi.doUnmock("@/app/actions/brand");
    }
  });

  it("uses first available option when none is marked selected", async () => {
    const bootstrap: Partial<WorkspaceBootstrap> = {
      portal: "client",
      workspaceContextOptions: [
        {
          key: "first-opt",
          label: "First Option",
          description: "Test",
          selected: false,
          tenantId: ids.client,
          tenantType: "client",
          kind: "client",
        },
      ],
    };

    vi.doMock("@/app/actions/brand", async (importOriginal) => {
      const actual = await importOriginal<typeof import("@/app/actions/brand")>();
      return {
        ...actual,
        getCachedPlatformBrand: vi.fn().mockResolvedValue(null),
      };
    });

    try {
      const result = await getSidebarIdentity(bootstrap as WorkspaceBootstrap);
      expect(result.tenantName).toBe(`DAL WS Client ${ts}`);
    } finally {
      vi.doUnmock("@/app/actions/brand");
    }
  });
});
