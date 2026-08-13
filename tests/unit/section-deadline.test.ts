import { describe, expect, it } from "vitest";
import {
  applyTimeMultiplier,
  computeSkewMs,
  formatCountdown,
  isPastDeadline,
  remainingSeconds,
} from "@/lib/assess/section-timing";

describe("section-timing pure maths (LR-2 / #332)", () => {
  it("computes skew as the offset between the server and client clocks", () => {
    const serverNow = "2026-08-13T12:00:05.000Z";
    const clientNowMs = Date.parse("2026-08-13T12:00:00.000Z");
    // Server is 5s ahead of the client's clock.
    expect(computeSkewMs(serverNow, clientNowMs)).toBe(5000);
  });

  it("corrects remaining time using skew, not the raw client clock", () => {
    const deadlineAt = "2026-08-13T12:10:00.000Z";
    // Client clock reads 12:09:00 but is actually 5s behind the server.
    const clientNowMs = Date.parse("2026-08-13T12:09:00.000Z");
    const skewMs = 5000;
    // True server time is 12:09:05, so 55s remain, not 60s.
    expect(remainingSeconds(deadlineAt, skewMs, clientNowMs)).toBe(55);
  });

  it("never returns negative remaining time", () => {
    const deadlineAt = "2026-08-13T12:00:00.000Z";
    const nowMs = Date.parse("2026-08-13T12:05:00.000Z");
    expect(remainingSeconds(deadlineAt, 0, nowMs)).toBe(0);
  });

  it("rounds up to the next whole second (never shows 0 a tick before deadline)", () => {
    const deadlineAt = "2026-08-13T12:00:10.000Z";
    const nowMs = Date.parse("2026-08-13T12:00:09.250Z");
    expect(remainingSeconds(deadlineAt, 0, nowMs)).toBe(1);
  });

  it("isPastDeadline flips exactly when remaining hits zero", () => {
    const deadlineAt = "2026-08-13T12:00:00.000Z";
    expect(
      isPastDeadline(deadlineAt, 0, Date.parse("2026-08-13T11:59:59.000Z")),
    ).toBe(false);
    expect(
      isPastDeadline(deadlineAt, 0, Date.parse("2026-08-13T12:00:00.000Z")),
    ).toBe(true);
  });

  it("applies the accommodation multiplier the same way start_section_for_session does (ceil)", () => {
    expect(applyTimeMultiplier(1200, 1)).toBe(1200);
    expect(applyTimeMultiplier(1200, 1.25)).toBe(1500);
    expect(applyTimeMultiplier(1200, 1.5)).toBe(1800);
    // Rounds up, matching ceil(limit * multiplier) in the RPC.
    expect(applyTimeMultiplier(100, 1.25)).toBe(125);
    expect(applyTimeMultiplier(101, 1.25)).toBe(127); // 126.25 -> 127
  });

  it("formats countdown as mm:ss, clamped at zero", () => {
    expect(formatCountdown(0)).toBe("00:00");
    expect(formatCountdown(65)).toBe("01:05");
    expect(formatCountdown(-5)).toBe("00:00");
    expect(formatCountdown(3661)).toBe("61:01");
  });
});
