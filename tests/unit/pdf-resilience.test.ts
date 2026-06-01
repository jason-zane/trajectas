import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { generateAndStoreReportPdf, reportError } = vi.hoisted(() => ({
  generateAndStoreReportPdf: vi.fn(),
  reportError: vi.fn(),
}));
vi.mock("@/lib/reports/pdf", () => ({ generateAndStoreReportPdf }));
vi.mock("@/lib/observability/report-error", () => ({ reportError }));

import { generatePdfWithResilience } from "@/lib/reports/pdf-resilience";

describe("generatePdfWithResilience", () => {
  beforeEach(() => {
    generateAndStoreReportPdf.mockReset();
    reportError.mockReset();
    reportError.mockResolvedValue(undefined);
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("succeeds on the first attempt without alerting", async () => {
    generateAndStoreReportPdf.mockResolvedValue({});
    await generatePdfWithResilience("s1");
    expect(generateAndStoreReportPdf).toHaveBeenCalledTimes(1);
    expect(reportError).not.toHaveBeenCalled();
  });

  it("retries a transient failure and then succeeds (no alert)", async () => {
    generateAndStoreReportPdf
      .mockRejectedValueOnce(new Error("flake"))
      .mockResolvedValueOnce({});
    const p = generatePdfWithResilience("s2");
    await vi.runAllTimersAsync();
    await p;
    expect(generateAndStoreReportPdf).toHaveBeenCalledTimes(2);
    expect(reportError).not.toHaveBeenCalled();
  });

  it("alerts once after exhausting all attempts", async () => {
    generateAndStoreReportPdf.mockRejectedValue(new Error("down"));
    const p = generatePdfWithResilience("s3");
    await vi.runAllTimersAsync();
    await p;
    expect(generateAndStoreReportPdf).toHaveBeenCalledTimes(3);
    expect(reportError).toHaveBeenCalledTimes(1);
    const opts = reportError.mock.calls[0][1];
    expect(opts.source).toBe("reports.pdf");
    expect(opts.alert).toBe(true);
    expect(opts.context).toMatchObject({ snapshotId: "s3", attempts: 3 });
  });
});
