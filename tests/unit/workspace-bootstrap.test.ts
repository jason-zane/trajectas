import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  resolveAuthorizedScope: vi.fn(),
}));

const brand = vi.hoisted(() => ({
  getCachedEffectiveBrand: vi.fn(),
}));

const workspace = vi.hoisted(() => ({
  getWorkspaceContextOptions: vi.fn(),
  getWorkspaceRequestContext: vi.fn(),
}));

const headers = vi.hoisted(() => ({
  cookies: vi.fn(),
}));

vi.mock("@/lib/auth/authorization", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/authorization")>(
    "@/lib/auth/authorization"
  );
  return {
    ...actual,
    resolveAuthorizedScope: auth.resolveAuthorizedScope,
  };
});

vi.mock("@/app/actions/brand", () => ({
  getCachedEffectiveBrand: brand.getCachedEffectiveBrand,
}));

vi.mock("@/lib/auth/workspace-access", () => ({
  getWorkspaceContextOptions: workspace.getWorkspaceContextOptions,
}));

vi.mock("@/lib/workspace-request", () => ({
  getWorkspaceRequestContext: workspace.getWorkspaceRequestContext,
}));

vi.mock("next/headers", () => ({
  cookies: headers.cookies,
}));

import { AuthenticationRequiredError } from "@/lib/auth/authorization";
import { getWorkspaceBootstrap } from "@/lib/auth/workspace-bootstrap";

describe("getWorkspaceBootstrap", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    headers.cookies.mockResolvedValue({
      get: vi.fn((name: string) =>
        name === "sidebar_state" ? { value: "false" } : undefined
      ),
    });

    workspace.getWorkspaceRequestContext.mockResolvedValue({
      routePrefix: "/partner",
      isLocalDev: false,
    });

    brand.getCachedEffectiveBrand.mockResolvedValue({
      name: "Trajectas",
      primaryColor: "#2d6a5a",
      accentColor: "#c9a962",
      neutralTemperature: "warm",
      headingFont: "Instrument Serif",
      bodyFont: "Inter",
      monoFont: "JetBrains Mono",
      borderRadius: "soft",
      darkModeEnabled: true,
    });

    workspace.getWorkspaceContextOptions.mockResolvedValue([
      {
        key: "all",
        label: "All",
        description: "All contexts",
        kind: "all",
        selected: true,
      },
    ]);
  });

  it("assembles a bootstrap once per portal request", async () => {
    auth.resolveAuthorizedScope.mockResolvedValue({
      actor: {
        id: "actor-1",
        email: "user@example.com",
        role: "member",
        displayName: "User Example",
        isActive: true,
        partnerMemberships: [],
        clientMemberships: [],
        activeContext: null,
      },
      activeContext: null,
      previewContext: null,
      requestSurface: "partner",
      isPlatformAdmin: false,
      isLocalDevelopmentBypass: false,
      partnerIds: ["partner-1"],
      partnerAdminIds: [],
      clientIds: ["client-1"],
      clientAdminIds: [],
      supportSession: null,
    });

    const first = await getWorkspaceBootstrap("partner");
    const second = await getWorkspaceBootstrap("partner");

    expect(first).toEqual(second);
    expect(first.sidebarDefaultOpen).toBe(false);
    expect(first.routePrefix).toBe("/partner");
    expect(first.isLocalDev).toBe(false);
    expect(first.workspaceContextOptions).toEqual([
      {
        key: "all",
        label: "All",
        description: "All contexts",
        kind: "all",
        selected: true,
      },
    ]);

    expect(auth.resolveAuthorizedScope).toHaveBeenCalled();
    expect(brand.getCachedEffectiveBrand).toHaveBeenCalled();
    expect(workspace.getWorkspaceContextOptions).toHaveBeenCalled();
    expect(workspace.getWorkspaceRequestContext).toHaveBeenCalled();
    expect(headers.cookies).toHaveBeenCalled();
  });

  it("returns a fallback bootstrap when auth is required", async () => {
    auth.resolveAuthorizedScope.mockRejectedValueOnce(
      new AuthenticationRequiredError()
    );

    const bootstrap = await getWorkspaceBootstrap("admin");

    expect(bootstrap.actor).toBeNull();
    expect(bootstrap.scope.actor).toBeNull();
    expect(bootstrap.scope.requestSurface).toBe("admin");
    expect(bootstrap.scope.isPlatformAdmin).toBe(false);
    expect(bootstrap.scope.isLocalDevelopmentBypass).toBe(false);
    expect(bootstrap.workspaceContextOptions).toEqual([]);
    expect(bootstrap.supportSessionInfo).toBeNull();
    expect(brand.getCachedEffectiveBrand).toHaveBeenCalledTimes(1);
    expect(workspace.getWorkspaceContextOptions).not.toHaveBeenCalled();
  });
});
