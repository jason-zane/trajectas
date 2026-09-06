import { describe, expect, it } from "vitest";
import {
  coefficientContrast,
  outcomeAnalysisCsv,
  predictorLabel,
  outcomeScatter,
  scoreReference,
} from "@/lib/outcomes/analysis";
import { outcomeResultSchema } from "@/lib/outcomes/result-schema";
import { redactSmallOutcomeCells } from "@/lib/outcomes/report";
import {
  outcomeReportFixture,
  outcomeRunFixture,
  outcomeDetailsFixture,
} from "../fixtures/business-outcomes";

describe("outcomes statistical workbench", () => {
  it("calculates signed linear changes and orders negative-shift intervals", () => {
    const r = outcomeRunFixture(),
      m = r.input.config.metrics[0],
      result = r.result!.results[0],
      f = result.findings[0];
    expect(coefficientContrast(m, result, f, -1)).toMatchObject({
      value: -3,
      lower: -4,
      upper: -2,
      mean: 70,
      predicted: 67,
    });
    expect(coefficientContrast(m, result, f, 0)).toMatchObject({
      value: 0,
      lower: 0,
      upper: 0,
      predicted: 70,
    });
    expect(() => coefficientContrast(m, result, f, 3)).toThrow(
      "observed score range",
    );
    expect(() => coefficientContrast(m, result, f, NaN)).toThrow(
      "finite score difference",
    );
  });
  it("uses model complete-case references rather than pairwise summaries", () => {
    const r = outcomeRunFixture(),
      result = r.result!.results[0],
      f = result.findings[0];
    f.scoreMean = 200;
    f.scoreMax = 500;
    result.mean = 99;
    expect(scoreReference(result, f)?.mean).toBe(3);
    expect(
      coefficientContrast(r.input.config.metrics[0], result, f, 1).predicted,
    ).toBe(73);
    result.model.details!.outcomeMean = 99;
    expect(() =>
      coefficientContrast(r.input.config.metrics[0], result, f, 1),
    ).toThrow("declared scale");
  });
  it("reports odds and rate ratios without treating them as probability changes", () => {
    const r = outcomeRunFixture(),
      result = r.result!.results[0],
      f = result.findings[0];
    f.adjusted = {
      value: Math.log(2),
      lower: 0,
      upper: Math.log(4),
      p: 0.01,
      q: 0.02,
    };
    expect(
      coefficientContrast(
        { ...r.input.config.metrics[0], kind: "binary" },
        result,
        f,
        1,
      ),
    ).toMatchObject({
      kind: "oddsRatio",
      value: 2,
      lower: 1,
      upper: 4,
      predicted: null,
    });
    expect(
      coefficientContrast(
        { ...r.input.config.metrics[0], kind: "count" },
        result,
        f,
        1,
      ).kind,
    ).toBe("rateRatio");
  });
  it("reads plots by selected IDs and tolerates older saved runs", () => {
    const r = outcomeRunFixture();
    expect(outcomeScatter(r, "kpi", "p")).toEqual([
      { x: 1, y: 65 },
      { x: 5, y: 75 },
    ]);
    expect(outcomeScatter(r, "missing", "p")).toEqual([]);
    delete r.result!.plots;
    expect(outcomeScatter(r, "kpi", "p")).toEqual([]);
    expect(
      outcomeResultSchema.safeParse(outcomeReportFixture().result).success,
    ).toBe(true);
  });
  it("exports every KPI and sanitises spreadsheet formula labels", () => {
    const r = outcomeRunFixture();
    r.input.predictors[0].label = "=SUM(A1)";
    r.input.config.metrics.push({
      ...r.input.config.metrics[0],
      id: "second",
      label: "Engagement",
    });
    r.result!.results.push({ ...r.result!.results[0], metricId: "second" });
    const csv = outcomeAnalysisCsv(r);
    expect(csv.split("\r\n")).toHaveLength(3);
    expect(csv).toContain('"\'=SUM(A1)"');
    expect(csv).toContain('"Engagement"');
    expect(csv).toContain('"standardized_beta"');
    expect(csv).toContain('"run_id"');
    expect(csv).toContain('"norm_version"');
    expect(csv).toContain('"coefficient_unit"');
    expect(csv).toContain('"points per score point"');
  });
  it("strips individual plots and contextual terms from client report payloads", () => {
    const p = outcomeReportFixture();
    p.result = outcomeRunFixture().result!;
    const safe = redactSmallOutcomeCells(p);
    expect(safe.result.plots).toBeUndefined();
    expect(safe.result.results[0].model.details?.residuals).toEqual([]);
    expect(
      safe.result.results[0].model.details?.terms.map((t) => t.kind),
    ).toEqual(["capability"]);
    expect(safe.result.results[0].model.details?.references).toEqual([]);
    expect(p.result.plots).toBeDefined();
    expect(p.result.results[0].model.details?.terms).toHaveLength(3);
  });
  it("validates new numerical output and rejects nonfinite diagnostics", () => {
    const r = outcomeRunFixture();
    expect(outcomeResultSchema.safeParse(r.result).success).toBe(true);
    r.result!.results[0].model.details = {
      ...outcomeDetailsFixture(),
      r2: NaN,
    };
    expect(outcomeResultSchema.safeParse(r.result).success).toBe(false);
  });
  it("distinguishes equal capability labels from different scoring identities", () => {
    const first = outcomeRunFixture().input.predictors[0];
    const second = { ...first, id: "another-identity", normVersion: "2026" };
    expect(predictorLabel(first, [first])).toBe("Empathy");
    expect(predictorLabel(first, [first, second])).not.toBe(
      predictorLabel(second, [first, second]),
    );
    expect(predictorLabel(second, [first, second])).toContain("2026");
    expect(predictorLabel(second, [first, second])).toContain("Service");
  });
});
