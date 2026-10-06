import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveUsagePeriod } from "@/lib/usage/period";

const mocks = vi.hoisted(() => ({
  requireClientAccess: vi.fn(),
  requirePartnerAccess: vi.fn(),
  requireAdminScope: vi.fn(),
  createAdminClient: vi.fn(),
}));
vi.mock("@/lib/auth/authorization", () => ({
  AuthorizationError: class extends Error {},
  requireClientAccess: mocks.requireClientAccess,
  requirePartnerAccess: mocks.requirePartnerAccess,
  requireAdminScope: mocks.requireAdminScope,
  isUnconfinedPlatformAdmin: (scope: { unrestricted?: boolean }) =>
    scope.unrestricted === true,
  applyTenantClientFilter: (
    query: { in: (column: string, values: string[]) => unknown },
    scope: { clientIds: string[]; unrestricted?: boolean },
    column: string,
  ) =>
    scope.unrestricted
      ? query
      : scope.clientIds.length
        ? query.in(column, scope.clientIds)
        : null,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));
import { getUsageReport, readUsagePages } from "@/lib/dal/usage-report";

beforeEach(() => {
  mocks.requireClientAccess.mockResolvedValue({
    scope: { clientIds: [], partnerIds: [] },
  });
  mocks.requirePartnerAccess.mockResolvedValue({
    scope: { clientIds: [], partnerIds: [] },
  });
});

describe("usage DAL pagination", () => {
  it("continues across lower server row caps without losing rows", async () => {
    const all = Array.from({ length: 1101 }, (_, id) => ({ id }));
    const page = vi.fn(async (offset: number) => ({
      data: all.slice(offset, offset + 200),
      error: null,
    }));
    expect(await readUsagePages(page)).toHaveLength(1101);
    expect(page.mock.calls.map(([offset]) => offset)).toEqual([
      0, 200, 400, 600, 800, 1000, 1101,
    ]);
  });
  it("fails rather than serving partial billing totals when a page fails", async () => {
    const page = vi
      .fn()
      .mockResolvedValueOnce({ data: [{ id: "one" }], error: null })
      .mockResolvedValueOnce({ data: null, error: new Error("query failed") });
    await expect(readUsagePages(page)).rejects.toThrow(
      "Unable to load usage activity",
    );
  });
});

describe("usage DAL access", () => {
  const period = resolveUsagePeriod({}, new Date("2026-10-06T00:00:00Z"));
  it("rejects cross-client requests before opening the reporting database", async () => {
    mocks.requireClientAccess.mockRejectedValue(new Error("No access"));
    await expect(
      getUsageReport({ kind: "client", id: "other-client" }, period),
    ).rejects.toThrow("No access");
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });
  it("does not treat a platform role in a confined workspace as access to another partner", async () => {
    mocks.requirePartnerAccess.mockResolvedValue({
      scope: {
        isPlatformAdmin: true,
        clientIds: ["own-client"],
        partnerIds: ["own-partner"],
      },
    });
    await expect(
      getUsageReport({ kind: "partner", id: "other-partner" }, period),
    ).rejects.toThrow();
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });
  it("requires platform authorization for Business reporting", async () => {
    mocks.requireAdminScope.mockRejectedValue(new Error("Admin required"));
    await expect(getUsageReport({ kind: "business" }, period)).rejects.toThrow(
      "Admin required",
    );
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });
});
