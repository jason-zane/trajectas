import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createReportAccessToken,
  verifyReportAccessToken,
} from "@/lib/reports/report-access-token";
import {
  createReportPdfToken,
  verifyReportPdfToken,
} from "@/lib/reports/pdf-token";
import {
  createPreviewPdfToken,
  verifyPreviewPdfToken,
} from "@/lib/reports/preview-pdf-token";

function clearTokenEnv() {
  delete process.env.REPORT_ACCESS_TOKEN_SECRET;
  delete process.env.REPORT_PDF_TOKEN_SECRET;
  delete process.env.TRAJECTAS_CONTEXT_SECRET;
  delete process.env.INTERNAL_API_KEY;
}

describe("report token signing secrets", () => {
  beforeEach(() => {
    clearTokenEnv();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    clearTokenEnv();
  });

  it("requires the dedicated report access secret in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("TRAJECTAS_CONTEXT_SECRET", "legacy-context");
    vi.stubEnv("INTERNAL_API_KEY", "legacy-internal");

    expect(() => createReportAccessToken("snapshot-1", "participant-1")).toThrow(
      /REPORT_ACCESS_TOKEN_SECRET/
    );
  });

  it("requires the dedicated report PDF secret in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("TRAJECTAS_CONTEXT_SECRET", "legacy-context");
    vi.stubEnv("INTERNAL_API_KEY", "legacy-internal");

    expect(() => createReportPdfToken("snapshot-1")).toThrow(
      /REPORT_PDF_TOKEN_SECRET/
    );
    expect(() => createPreviewPdfToken("template-1", "assessment-1")).toThrow(
      /REPORT_PDF_TOKEN_SECRET/
    );
  });

  it("round-trips report and PDF tokens with dedicated secrets", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("REPORT_ACCESS_TOKEN_SECRET", "access-secret");
    vi.stubEnv("REPORT_PDF_TOKEN_SECRET", "pdf-secret");

    const access = createReportAccessToken("snapshot-1", "participant-1");
    expect(verifyReportAccessToken(access, "snapshot-1")).toEqual({
      participantId: "participant-1",
    });

    const pdf = createReportPdfToken("snapshot-1");
    expect(verifyReportPdfToken(pdf, "snapshot-1")).toBe(true);

    const preview = createPreviewPdfToken("template-1", "assessment-1");
    expect(verifyPreviewPdfToken(preview, "template-1", "assessment-1")).toBe(true);
  });

  it("keeps legacy fallback only outside production for local compatibility", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("TRAJECTAS_CONTEXT_SECRET", "local-context");

    const token = createReportAccessToken("snapshot-1", "participant-1");
    expect(verifyReportAccessToken(token, "snapshot-1")).toEqual({
      participantId: "participant-1",
    });
  });
});
