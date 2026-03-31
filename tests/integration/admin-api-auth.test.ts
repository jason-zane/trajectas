import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => {
  class AuthenticationRequiredError extends Error {}
  class AuthorizationError extends Error {}

  return {
    requireAdminScope: vi.fn(),
    AuthenticationRequiredError,
    AuthorizationError,
  };
});

const generation = vi.hoisted(() => ({
  startGenerationRun: vi.fn(),
}));

vi.mock("@/lib/auth/authorization", () => ({
  requireAdminScope: auth.requireAdminScope,
  AuthenticationRequiredError: auth.AuthenticationRequiredError,
  AuthorizationError: auth.AuthorizationError,
}));

vi.mock("@/app/actions/generation", () => ({
  startGenerationRun: generation.startGenerationRun,
}));

import { POST } from "@/app/api/generation/start/route";

describe("admin API auth", () => {
  beforeEach(() => {
    auth.requireAdminScope.mockReset();
    generation.startGenerationRun.mockReset();
  });

  it("returns 401 when authentication is missing", async () => {
    auth.requireAdminScope.mockRejectedValueOnce(
      new auth.AuthenticationRequiredError("login required")
    );

    const response = await POST(
      new Request("http://localhost/api/generation/start", {
        method: "POST",
        body: JSON.stringify({ runId: "run-1" }),
      })
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Authentication is required",
    });
  });

  it("returns 403 when the caller is authenticated but not allowed", async () => {
    auth.requireAdminScope.mockRejectedValueOnce(
      new auth.AuthorizationError("This action is restricted to platform admin.")
    );

    const response = await POST(
      new Request("http://localhost/api/generation/start", {
        method: "POST",
        body: JSON.stringify({ runId: "run-1" }),
      })
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "This action is restricted to platform admin.",
    });
  });

  it("returns 400 when the request body is missing the run id", async () => {
    auth.requireAdminScope.mockResolvedValueOnce(undefined);

    const response = await POST(
      new Request("http://localhost/api/generation/start", {
        method: "POST",
        body: JSON.stringify({}),
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "runId is required",
    });
  });

  it("returns 200 and no-store headers for an authorized request", async () => {
    auth.requireAdminScope.mockResolvedValueOnce(undefined);
    generation.startGenerationRun.mockResolvedValueOnce({
      runId: "run-1",
      status: "started",
    });

    const response = await POST(
      new Request("http://localhost/api/generation/start", {
        method: "POST",
        body: JSON.stringify({ runId: "run-1" }),
      })
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    await expect(response.json()).resolves.toEqual({
      runId: "run-1",
      status: "started",
    });
    expect(generation.startGenerationRun).toHaveBeenCalledWith("run-1");
  });
});
