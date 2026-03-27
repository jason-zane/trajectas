"use client";

import { useState, useEffect, useCallback } from "react";
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

  const colorClass =
    remaining <= 30
      ? "text-destructive"
      : remaining <= 120
        ? "text-amber-500"
        : "text-muted-foreground";

  return (
    <div className={`flex items-center gap-1.5 text-sm font-mono ${colorClass}`}>
      <Clock className="size-4" />
      <span>
        {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
      </span>
    </div>
  );
}
