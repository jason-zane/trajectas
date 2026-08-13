"use client";

import { useEffect, useRef, useState } from "react";
import { Clock } from "lucide-react";
import {
  computeSkewMs,
  formatCountdown,
  remainingSeconds,
} from "@/lib/assess/section-timing";

interface SectionTimerProps {
  /** Server-issued deadline (ISO timestamp) — the sole source of truth.
   *  Comes from SectionForRunner.timing (start_section_for_session). */
  deadlineAt: string;
  /** Server clock at the moment this timing was issued (ISO timestamp).
   *  Used once, at mount, to compute the client/server clock offset — the
   *  client's own clock is never trusted for anything but rendering. */
  serverNow: string;
  onExpiry: () => void;
  onTick?: (remainingSecondsLeft: number) => void;
}

const TICK_MS = 250;

/**
 * Server-authoritative countdown display.
 *
 * Replaces the previous implementation, which recreated its setInterval on
 * every tick (its useEffect depended on the `remaining` state it was also
 * setting) and drifted several seconds per minute as a result. This version
 * schedules ONE interval per (deadlineAt, serverNow) pair and always
 * recomputes remaining time from Date.now() + skewMs against the fixed
 * deadline — ticking more often than the display updates cannot accumulate
 * error, because nothing here depends on the previous tick's output.
 */
export function SectionTimer({
  deadlineAt,
  serverNow,
  onExpiry,
  onTick,
}: SectionTimerProps) {
  // Real skew (against the client's actual clock) is computed inside the
  // effect below, once mounted — components must stay pure during render
  // (no Date.now()), so this starts at 0 and is corrected before the first
  // tick fires.
  const skewMsRef = useRef<number>(0);
  const expiredFiredRef = useRef(false);
  // Keep the latest callbacks in refs so the effect below never needs them
  // in its dependency array — only a genuinely new deadline should restart
  // the interval.
  const onExpiryRef = useRef(onExpiry);
  const onTickRef = useRef(onTick);
  useEffect(() => {
    onExpiryRef.current = onExpiry;
    onTickRef.current = onTick;
  });

  // Initial paint uses the server's own clock (deadlineAt vs. serverNow,
  // both server timestamps) rather than the client's Date.now() — a pure
  // function of props, and a reasonable proxy for "now" until the effect
  // below corrects it against the client's actual clock a moment later.
  const [remaining, setRemaining] = useState(() =>
    remainingSeconds(deadlineAt, 0, Date.parse(serverNow)),
  );

  useEffect(() => {
    skewMsRef.current = computeSkewMs(serverNow, Date.now());
    expiredFiredRef.current = false;

    function tick() {
      const next = remainingSeconds(deadlineAt, skewMsRef.current, Date.now());
      setRemaining(next);
      onTickRef.current?.(next);
      if (next <= 0 && !expiredFiredRef.current) {
        expiredFiredRef.current = true;
        onExpiryRef.current();
      }
    }

    // Fire immediately — covers a deadline that has already passed by the
    // time this mounts (e.g. a slow page load), rather than waiting a full
    // TICK_MS before the participant sees the true state.
    tick();
    const interval = setInterval(tick, TICK_MS);

    // A backgrounded mobile tab throttles (or fully suspends) setInterval.
    // Resync on return rather than trusting the throttled cadence to have
    // kept up — the recomputation is always correct regardless of how long
    // the tab was hidden, because it reads the wall clock, not a counter.
    function handleVisibilityChange() {
      if (document.visibilityState === "visible") tick();
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pageshow", tick);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pageshow", tick);
    };
    // deadlineAt/serverNow only change when the participant enters a new
    // section — NOT `remaining`. That dependency is exactly the bug this
    // replaces (see the module docstring above).
  }, [deadlineAt, serverNow]);

  let timerColor = "var(--runner-text-meta)";
  if (remaining <= 30) {
    timerColor = "var(--brand-error)";
  } else if (remaining <= 120) {
    timerColor = "var(--brand-warning)";
  }

  return (
    <div
      className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
      style={{ color: timerColor, fontFamily: '"Geist Mono", ui-monospace, monospace' }}
      role="timer"
      aria-label="Time remaining in this section"
      aria-live="off"
    >
      <Clock className="size-3.5" />
      <span>{formatCountdown(remaining)}</span>
    </div>
  );
}
