import { describe, it, expect } from "vitest";
import {
  metricValue,
  scenarioValues,
  redactSmallOutcomeCells,
} from "@/lib/outcomes/report";
import {
  escapeReportHtml,
  outcomeReportHtml,
} from "@/lib/outcomes/pdf-document";
import type { OutcomeReportPayload } from "@/lib/outcomes/types";
import { EMPTY_OUTCOME_CONFIG } from "@/lib/outcomes/types";
function report(): OutcomeReportPayload {
  const metric = {
    id: "kpi",
    column: "csat",
    label: "Customer satisfaction",
    kind: "continuous" as const,
    unit: "points",
    display: "number" as const,
    direction: "higher" as const,
    currency: "AUD",
    minimum: 0,
    maximum: 100,
    exposureColumn: "",
  };
  return {
    version: 1,
    study: {
      title: "Test study",
      question: "What is associated with satisfaction?",
      clientName: "Example",
    },
    draft: {
      metricId: "kpi",
      predictorId: "p",
      headline: "A customer satisfaction relationship",
      interpretation: "Observed association.",
      recommendation: "Test a targeted initiative.",
      scenario: {
        enabled: false,
        shift: 1,
        people: 100,
        periods: 1,
        valuePerUnit: null,
        cost: 0,
        currency: "AUD",
      },
    },
    config: { ...EMPTY_OUTCOME_CONFIG, metrics: [metric] },
    predictors: [
      {
        id: "p",
        label: "Empathy",
        assessment: "Service",
        assessmentId: "a",
        factorId: "f",
        scoreField: "scaled_score",
        scoringMethod: "ctt",
        metric: "overall",
        variant: "",
        parameterScale: "",
        normVersion: "",
        normGroupId: "",
      },
    ],
    quality: {
      imported: 80,
      matched: 80,
      eligible: 80,
      excluded: {},
      warnings: [],
    },
    source: {
      checksum: "hash",
      filename: "test.csv",
      extractedAt: "2026-01-01",
      formVersions: [],
    },
    runId: "run",
    runCreatedAt: "2026-01-01",
    result: {
      engineVersion: "test",
      seed: 1,
      libraryVersions: {},
      warnings: [],
      results: [
        {
          metricId: "kpi",
          n: 80,
          missing: 0,
          mean: 70,
          sd: 10,
          findings: [
            {
              predictorId: "p",
              n: 80,
              correlation: {
                value: 0.5,
                lower: 0.3,
                upper: 0.7,
                p: 0.01,
                q: 0.02,
              },
              spearman: 0.4,
              groups: {
                low: 65,
                high: 75,
                lowN: 20,
                highN: 20,
                difference: 10,
                lower: 6,
                upper: 14,
              },
              adjusted: { value: 3, lower: 2, upper: 4, p: 0.01, q: 0.02 },
              scoreMin: 1,
              scoreMax: 5,
              scoreMean: 3,
              status: "supported",
              reason: null,
            },
          ],
          model: {
            method: "Linear regression",
            n: 80,
            parameters: 2,
            controls: [],
            warnings: [],
            unavailable: null,
          },
          validation: null,
          validationReason: "Test fixture",
        },
      ],
    },
  };
}
describe("business outcomes executive reporting", () => {
  it("uses KPI units and does not invent a financial story", () => {
    const p = report();
    expect(metricValue(10, p.config.metrics[0], true)).toBe("10 points");
    expect(scenarioValues(p)).toBeNull();
    const html = outcomeReportHtml(p);
    expect(html).toContain("Customer satisfaction");
    expect(html).not.toContain("Estimated gross value");
    expect(html).toContain("Observed difference");
    expect(html).toContain("Evidence and methods");
  });
  it("distinguishes probability changes from relative percentages", () => {
    const metric = {
      ...report().config.metrics[0],
      kind: "binary" as const,
      display: "percent" as const,
    };
    expect(metricValue(0.1, metric, true)).toBe("10 percentage points");
    expect(metricValue(0.8, metric)).toBe("80%");
  });
  it("makes non-financial scenarios without converting them into money", () => {
    const p = report();
    p.draft.scenario.enabled = true;
    expect(scenarioValues(p)).toMatchObject({
      delta: 3,
      gross: null,
      net: null,
    });
  });
  it("uses explicit population, period and conversion assumptions", () => {
    const p = report();
    p.draft.scenario = {
      ...p.draft.scenario,
      enabled: true,
      valuePerUnit: 2,
      periods: 2,
      cost: 100,
    };
    expect(scenarioValues(p)).toMatchObject({
      gross: 1200,
      net: 1100,
      financialRange: [800, 1600],
    });
  });
  it("rejects extrapolation beyond observed scores and bounded KPI ranges", () => {
    const p = report();
    p.draft.scenario = { ...p.draft.scenario, enabled: true, shift: 3 };
    expect(() => scenarioValues(p)).toThrow("observed score range");
    p.draft.scenario.shift = 1;
    p.result.results[0].mean = 99;
    expect(() => scenarioValues(p)).toThrow("declared scale");
  });
  it("does not monetise unsupported associations", () => {
    const p = report();
    p.draft.scenario.enabled = true;
    p.result.results[0].findings[0].status = "inconclusive";
    expect(() => scenarioValues(p)).toThrow("supported");
  });
  it("escapes every user-supplied narrative in printable HTML", () => {
    const p = report();
    p.draft.headline = "<script>alert(1)</script>";
    expect(outcomeReportHtml(p)).not.toContain("<script>");
    expect(escapeReportHtml('"<x>&')).toBe("&quot;&lt;x&gt;&amp;");
  });
  it("suppresses small-cell score statistics in client payloads", () => {
    const p = report();
    p.result.results[0].n = 4;
    p.result.results[0].findings[0].n = 4;
    const safe = redactSmallOutcomeCells(p);
    expect(safe.result.results[0].mean).toBeNull();
    expect(safe.result.results[0].findings[0].scoreMean).toBeNull();
    expect(safe.result.results[0].findings[0].adjusted).toBeNull();
  });
});

it("validates partial currency edits before attempting financial formatting", () => {
  const p = report();
  p.draft.scenario.enabled = true;
  p.draft.scenario.valuePerUnit = 10;
  for (const currency of ["", "A", "AU"]) {
    p.draft.scenario.currency = currency;
    expect(() => scenarioValues(p)).toThrow("three-letter currency");
  }
});
it("includes the observed contrast interval as a separate appendix estimate", () => {
  const html = outcomeReportHtml(report());
  expect(html).toContain("descriptive 95% Welch interval");
  expect(html).toContain("higher score group (n=");
});
