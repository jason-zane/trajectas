import { beforeEach, describe, expect, it, vi } from "vitest";
import { EMPTY_OUTCOME_CONFIG } from "@/lib/outcomes/types";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  reportError: vi.fn(),
  insert: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => mocks }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/observability/report-error", () => ({
  reportError: mocks.reportError,
}));
vi.mock("@/lib/security/action-errors", () => ({ logActionError: vi.fn() }));
vi.mock("@/lib/auth/authorization", () => ({
  requireAdminScope: async () => ({ actor: { id: "actor" } }),
  requireClientAccess: vi.fn(),
  resolveAuthorizedScope: vi.fn(),
  resolveTenantClientFilter: () => ["b470bd46-9dda-4f35-a158-88e86a43c337"],
  AuthorizationError: class extends Error {},
}));
// Numerical report validation has its own suite; this exercises the real
// publication and audit failure path with a successfully persisted report.
vi.mock("@/lib/outcomes/report", () => ({
  validateOutcomeReport: vi.fn(),
  redactSmallOutcomeCells: (payload: unknown) => payload,
}));
import { createOutcomeStudy, publishOutcomeReport } from "@/lib/dal/outcomes";
const clientId = "b470bd46-9dda-4f35-a158-88e86a43c337";

beforeEach(() => {
  mocks.reportError.mockResolvedValue(undefined);
  mocks.from.mockImplementation((table: string) => {
    if (table === "audit_events")
      return {
        insert: vi
          .fn()
          .mockResolvedValue({ error: { message: "audit store unavailable" } }),
      };
    const data =
      table === "outcome_studies"
        ? {
            id: "study",
            client_id: clientId,
            title: "Study",
            question: "Question",
            config: EMPTY_OUTCOME_CONFIG,
            revision: 1,
            created_at: "2026-01-01",
            clients: { name: "Client" },
          }
        : table === "outcome_runs"
          ? {
              id: "run",
              created_at: "2026-01-01",
              status: "completed",
              error: null,
              result: { results: [] },
              input_summary: {
                config: EMPTY_OUTCOME_CONFIG,
                predictors: [],
                quality: {},
                source: {},
              },
            }
          : { id: "published-report" };
    const builder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data, error: null }),
      insert: (value: unknown) => {
        mocks.insert(table, value);
        return builder;
      },
    };
    return builder;
  });
});

describe("Outcome post-mutation audit failures", () => {
  it("returns the committed publication instead of prompting a duplicate retry", async () => {
    await expect(
      publishOutcomeReport("study", "run", {
        metricId: "kpi",
        predictorId: "score",
        headline: "Observed difference",
        interpretation: "A relationship to investigate.",
        recommendation: "Test the relationship.",
        scenario: {
          enabled: false,
          shift: 1,
          people: 100,
          periods: 1,
          valuePerUnit: null,
          cost: 0,
          currency: "AUD",
        },
      }),
    ).resolves.toBe("published-report");
    expect(mocks.insert).toHaveBeenCalledTimes(1);
    expect(mocks.reportError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        source: "audit.insert_failed",
        alert: true,
        context: expect.objectContaining({
          eventType: "outcome_report_published",
          targetId: "published-report",
        }),
      }),
    );
  });

  it("also preserves a successful study creation while reporting the audit failure", async () => {
    await expect(
      createOutcomeStudy({ clientId, title: "Study", question: "Question" }),
    ).resolves.toBe("study");
    expect(mocks.insert).toHaveBeenCalledTimes(1);
    expect(mocks.reportError).toHaveBeenCalledTimes(1);
  });
});
