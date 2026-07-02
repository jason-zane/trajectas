import { describe, expect, it } from "vitest";
import {
  AGGREGATE_MIN_GROUP_SIZE,
  ANON_THRESHOLD,
  canViewIndividualResults,
  isAggregateOnly,
  shouldGenerateIndividualReports,
} from "@/lib/reports/confidentiality";

describe("isAggregateOnly", () => {
  it("is true only for the aggregate_only mode", () => {
    expect(isAggregateOnly("aggregate_only")).toBe(true);
    expect(isAggregateOnly("standard")).toBe(false);
  });

  it("treats null/undefined as not aggregate-only (default standard)", () => {
    expect(isAggregateOnly(null)).toBe(false);
    expect(isAggregateOnly(undefined)).toBe(false);
  });
});

describe("canViewIndividualResults", () => {
  it("allows any viewer on a standard campaign", () => {
    expect(
      canViewIndividualResults("standard", { isPlatformAdmin: false }),
    ).toBe(true);
    expect(
      canViewIndividualResults("standard", { isPlatformAdmin: true }),
    ).toBe(true);
  });

  it("blocks a non-platform-admin on an aggregate-only campaign", () => {
    expect(
      canViewIndividualResults("aggregate_only", { isPlatformAdmin: false }),
    ).toBe(false);
  });

  it("still allows a platform admin on an aggregate-only campaign (support / QA)", () => {
    expect(
      canViewIndividualResults("aggregate_only", { isPlatformAdmin: true }),
    ).toBe(true);
  });

  it("defaults an unset mode to standard (viewable)", () => {
    expect(canViewIndividualResults(null, { isPlatformAdmin: false })).toBe(
      true,
    );
    expect(
      canViewIndividualResults(undefined, { isPlatformAdmin: false }),
    ).toBe(true);
  });
});

describe("shouldGenerateIndividualReports", () => {
  it("generates for standard, skips for aggregate_only", () => {
    expect(shouldGenerateIndividualReports("standard")).toBe(true);
    expect(shouldGenerateIndividualReports("aggregate_only")).toBe(false);
  });

  it("generates when mode is unset (default standard)", () => {
    expect(shouldGenerateIndividualReports(null)).toBe(true);
    expect(shouldGenerateIndividualReports(undefined)).toBe(true);
  });
});

describe("k-anonymity thresholds", () => {
  it("aggregate min group size matches the rater anonymity threshold", () => {
    expect(AGGREGATE_MIN_GROUP_SIZE).toBe(3);
    expect(ANON_THRESHOLD).toBe(3);
    expect(AGGREGATE_MIN_GROUP_SIZE).toBe(ANON_THRESHOLD);
  });
});
