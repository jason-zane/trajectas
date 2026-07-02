"use client";

import { useState, useEffect } from "react";
import { Clock } from "lucide-react";

interface SectionTimerProps {
  initialSeconds: number;
  onExpiry: () => void;
  onTick?: (remaining: number) => void;
}

export function SectionTimer({
  initialSeconds,
  onExpiry,
  onTick,
}: SectionTimerProps) {
  const [remaining, setRemaining] = useState(initialSeconds);

  useEffect(() => {
    if (remaining <= 0) {
      onExpiry();
      return;
    }

    const interval = setInterval(() => {
      setRemaining((prev) => {
        const next = prev - 1;
        onTick?.(next);
        if (next <= 0) {
          onExpiry();
          clearInterval(interval);
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [remaining, onExpiry, onTick]);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;

  // Color changes based on remaining time
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
    >
      <Clock className="size-3.5" />
      <span>
        {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
      </span>
    </div>
  );
}
