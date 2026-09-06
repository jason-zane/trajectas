import { beforeEach, describe, expect, it, vi } from "vitest";
import { outcomeInputHash } from "@/lib/outcomes/snapshot";
import { EMPTY_OUTCOME_CONFIG, type OutcomeInput } from "@/lib/outcomes/types";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
  update: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => mocks }));
vi.mock("@/lib/security/action-errors", () => ({ logActionError: vi.fn() }));
import { GET } from "@/app/api/cron/outcome-analysis-sweep/route";
import { runNextOutcomeJob, runOutcomeJobBatch } from "@/lib/dal/outcome-jobs";

const input: OutcomeInput = {
  version: 1,
  config: EMPTY_OUTCOME_CONFIG,
  predictors: [],
  rows: [],
  quality: { imported: 0, matched: 0, eligible: 0, excluded: {}, warnings: [] },
  source: {
    checksum: "test",
    filename: "test.csv",
    extractedAt: "2026-01-01",
    formVersions: [],
  },
};
const output = {
  engineVersion: "test",
  libraryVersions: {},
  seed: 1,
  warnings: [],
  results: [],
};
const job = (id: string) => ({
  id,
  input,
  input_hash: outcomeInputHash(input),
  lease_id: `lease-${id}`,
  attempts: 1,
});

beforeEach(() => {
  vi.stubEnv("CRON_SECRET", "local-test-signing-secret");
  vi.stubEnv("OUTCOMES_WORKER_URL", "https://worker.test/api/outcomes-worker");
  const saved = { error: null, eq: vi.fn().mockReturnThis() };
  mocks.update.mockReturnValue(saved);
  mocks.from.mockReturnValue({ update: mocks.update });
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(async () => Response.json(output)),
  );
});

describe("Outcome queue execution", () => {
  it("claims sequentially but runs both cron workers concurrently", async () => {
    let activeClaims = 0,
      maxActiveClaims = 0,
      nextJob = 0;
    mocks.rpc.mockImplementation(async () => {
      activeClaims++;
      maxActiveClaims = Math.max(maxActiveClaims, activeClaims);
      // Model the database's nonblocking advisory lock: overlap loses a claim.
      const wonLock = activeClaims === 1;
      await new Promise<void>((resolve) => queueMicrotask(resolve));
      activeClaims--;
      return { data: wonLock ? [job(String(++nextJob))] : [], error: null };
    });
    const release: (() => void)[] = [];
    vi.mocked(fetch).mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          release.push(() => resolve(Response.json(output)));
        }),
    );
    const pending = GET(
      new Request("https://app.test/api/cron/outcome-analysis-sweep", {
        headers: { authorization: "Bearer local-test-signing-secret" },
      }),
    );
    await vi.waitFor(() => expect(release).toHaveLength(2));
    expect(maxActiveClaims).toBe(1);
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
    release.forEach((resolve) => resolve());
    const response = await pending;
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ started: 2 });
    expect(mocks.update.mock.calls.map(([value]) => value.status)).toEqual([
      "completed",
      "completed",
    ]);
  });

  it("executes a lease already claimed when the next claim fails", async () => {
    mocks.rpc
      .mockResolvedValueOnce({ data: [job("first")], error: null })
      .mockResolvedValueOnce({
        data: null,
        error: { message: "temporary claim failure" },
      });
    await expect(runOutcomeJobBatch()).resolves.toBe(1);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "completed" }),
    );
  });

  it("does no numerical work when the queue has no available lease", async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null });
    await expect(runOutcomeJobBatch()).resolves.toBe(0);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("preserves the immediate callback's single requested run", async () => {
    mocks.rpc.mockResolvedValue({ data: [job("requested")], error: null });
    await expect(runNextOutcomeJob("requested")).resolves.toBe(true);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("claim_outcome_run", {
      p_run_id: "requested",
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("never acquires a lease without a signing secret", async () => {
    vi.stubEnv("CRON_SECRET", "");
    await expect(runOutcomeJobBatch()).rejects.toThrow(
      "signing is not configured",
    );
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
