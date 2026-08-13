// @vitest-environment jsdom

import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SectionTimer } from "@/components/assess/section-timer";

describe("SectionTimer (LR-2 / #332)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-13T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("counts down from the server deadline and fires onExpiry exactly once", () => {
    const onExpiry = vi.fn();
    const deadlineAt = new Date(Date.now() + 3000).toISOString();
    const serverNow = new Date().toISOString();

    render(<SectionTimer deadlineAt={deadlineAt} serverNow={serverNow} onExpiry={onExpiry} />);

    expect(screen.getByRole("timer")).toHaveTextContent("00:03");

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByRole("timer")).toHaveTextContent("00:02");
    expect(onExpiry).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByRole("timer")).toHaveTextContent("00:00");
    expect(onExpiry).toHaveBeenCalledTimes(1);

    // Further ticks after expiry must not re-fire onExpiry.
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(onExpiry).toHaveBeenCalledTimes(1);
  });

  it("does not drift over many ticks — the interval never depends on the countdown value", () => {
    const onExpiry = vi.fn();
    const deadlineAt = new Date(Date.now() + 10 * 60_000).toISOString(); // 10 min out
    const serverNow = new Date().toISOString();

    render(<SectionTimer deadlineAt={deadlineAt} serverNow={serverNow} onExpiry={onExpiry} />);

    // The previous implementation recreated its setInterval on every tick
    // (its effect depended on the `remaining` state it was also setting)
    // and drifted several seconds per minute as a result. This one always
    // re-reads Date.now() against a fixed deadline, so after exactly 5
    // simulated minutes of 250ms ticks the display must read exactly 5:00
    // remaining — not off by any accumulated scheduling error.
    act(() => {
      vi.advanceTimersByTime(5 * 60_000);
    });

    expect(screen.getByRole("timer")).toHaveTextContent("05:00");
    expect(onExpiry).not.toHaveBeenCalled();
  });

  it("re-syncs on visibilitychange instead of trusting a throttled background tab", () => {
    const onExpiry = vi.fn();
    const deadlineAt = new Date(Date.now() + 60_000).toISOString();
    const serverNow = new Date().toISOString();

    render(<SectionTimer deadlineAt={deadlineAt} serverNow={serverNow} onExpiry={onExpiry} />);

    // Simulate a throttled/suspended background tab: the wall clock (and
    // system clock) moves 40s but no interval callback fires — model that
    // by advancing the mocked clock directly, then dispatching
    // visibilitychange without advancing fake timers.
    vi.setSystemTime(new Date(Date.now() + 40_000));
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(screen.getByRole("timer")).toHaveTextContent("00:20");
  });

  it("computes remaining time from the server clock, correcting for client skew", () => {
    const onExpiry = vi.fn();
    const deadlineAt = "2026-08-13T12:01:00.000Z";
    // serverNow claims the server was 10s ahead of the client's Date.now()
    // (mocked to 12:00:00) at the moment timing was issued.
    const serverNow = "2026-08-13T12:00:10.000Z";

    render(<SectionTimer deadlineAt={deadlineAt} serverNow={serverNow} onExpiry={onExpiry} />);

    // True remaining = deadline - (clientNow + skew) = 12:01:00 - 12:00:10 = 50s.
    expect(screen.getByRole("timer")).toHaveTextContent("00:50");
  });

  it("fires onExpiry immediately on mount if the deadline has already passed", () => {
    const onExpiry = vi.fn();
    const deadlineAt = new Date(Date.now() - 5000).toISOString(); // already past
    const serverNow = new Date().toISOString();

    render(<SectionTimer deadlineAt={deadlineAt} serverNow={serverNow} onExpiry={onExpiry} />);

    expect(screen.getByRole("timer")).toHaveTextContent("00:00");
    expect(onExpiry).toHaveBeenCalledTimes(1);
  });
});
