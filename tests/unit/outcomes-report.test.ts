import { reportDraftSchema } from "@/lib/outcomes/validation";
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
import { outcomeReportFixture as report } from "../fixtures/business-outcomes";
describe("business outcomes executive reporting", () => {
  it("uses KPI units and does not invent a financial story", () => {
    const p = report();
    expect(metricValue(10, p.config.metrics[0], true)).toBe("10 points");
    expect(scenarioValues(p)).toBeNull();
    const html = outcomeReportHtml(p);
    expect(html).toContain("Customer satisfaction");
    expect(html).toContain('aria-label="Trajectas"');
    expect(html).not.toContain("trajectas<span");
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

it("allows a non-financial draft after clearing the optional money conversion", () => {
  const p = report();
  p.draft.scenario.enabled = true;
  p.draft.scenario.currency = "AU";
  p.draft.scenario.valuePerUnit = null;
  expect(reportDraftSchema.safeParse(p.draft).success).toBe(true);
  p.draft.scenario.valuePerUnit = 10;
  expect(reportDraftSchema.safeParse(p.draft).success).toBe(false);
});

it("persists optional report sections and leaves legacy report defaults intact", () => {
  const p = report();
  expect(outcomeReportHtml(p)).toContain('class="appendix"');
  p.draft.sections = {
    comparison: false,
    interpretation: false,
    recommendation: false,
    technical: false,
  };
  expect(reportDraftSchema.parse(p.draft).sections).toEqual(p.draft.sections);
  const html = outcomeReportHtml(p);
  expect(html).not.toContain("<figure");
  expect(html).not.toContain('<section class="meaning"');
  expect(html).not.toContain('<section class="recommendation"');
  expect(html).not.toContain('<section class="appendix"');
  expect(html).toContain("Observed associations do not establish");
  expect(html).toContain(p.draft.headline);
});
