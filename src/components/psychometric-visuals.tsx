"use client"

import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// MetricGauge — a small radial gauge for a 0–1 metric value
// ---------------------------------------------------------------------------

type GaugeStatus = "good" | "acceptable" | "poor"

function getGaugeColor(status: GaugeStatus) {
  return {
    good: "text-[var(--success)] stroke-[var(--success)]",
    acceptable: "text-[var(--warning)] stroke-[var(--warning)]",
    poor: "text-[var(--destructive)] stroke-[var(--destructive)]",
  }[status]
}

function getGaugeTrack(status: GaugeStatus) {
  return {
    good: "stroke-[var(--success)]/15",
    acceptable: "stroke-[var(--warning)]/15",
    poor: "stroke-[var(--destructive)]/15",
  }[status]
}

interface MetricGaugeProps {
  value: number | null
  label?: string
  status?: GaugeStatus
  size?: number
  className?: string
}

export function MetricGauge({
  value,
  label,
  status = "good",
  size = 56,
  className,
}: MetricGaugeProps) {
  const displayValue = value !== null ? value.toFixed(2) : "—"
  const radius = (size - 8) / 2
  const circumference = 2 * Math.PI * radius
  const progress = value !== null ? Math.min(Math.max(value, 0), 1) : 0
  const strokeDashoffset = circumference * (1 - progress)

  return (
    <div className={cn("flex flex-col items-center gap-1", className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90"
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={4}
            className={getGaugeTrack(status)}
          />
          {value !== null && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              strokeWidth={4}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className={cn(
                "transition-all duration-700 ease-out",
                getGaugeColor(status)
              )}
            />
          )}
        </svg>
        <span
          className={cn(
            "absolute inset-0 flex items-center justify-center text-xs font-semibold tabular-nums",
            getGaugeColor(status)
          )}
        >
          {displayValue}
        </span>
      </div>
      {label && (
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
          {label}
        </span>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// HorizontalBar — a horizontal bar for a 0–1 metric
// ---------------------------------------------------------------------------

interface HorizontalBarProps {
  value: number | null
  label?: string
  status?: GaugeStatus
  className?: string
}

export function HorizontalBar({
  value,
  label,
  status = "good",
  className,
}: HorizontalBarProps) {
  const displayValue = value !== null ? value.toFixed(2) : "—"
  const pct = value !== null ? Math.min(Math.max(value * 100, 0), 100) : 0

  const barColor = {
    good: "bg-[var(--success)]",
    acceptable: "bg-[var(--warning)]",
    poor: "bg-[var(--destructive)]",
  }[status]

  const trackColor = {
    good: "bg-[var(--success)]/15",
    acceptable: "bg-[var(--warning)]/15",
    poor: "bg-[var(--destructive)]/15",
  }[status]

  const textColor = getGaugeColor(status)

  return (
    <div className={cn("flex flex-col gap-1 min-w-0", className)}>
      {label && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            {label}
          </span>
          <span
            className={cn(
              "text-xs font-semibold tabular-nums",
              textColor
            )}
          >
            {displayValue}
          </span>
        </div>
      )}
      <div
        className={cn("h-1.5 w-full rounded-full overflow-hidden", trackColor)}
      >
        <div
          className={cn(
            "h-full rounded-full transition-all duration-700 ease-out",
            barColor
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      {!label && (
        <span
          className={cn(
            "text-xs font-semibold tabular-nums text-right",
            textColor
          )}
        >
          {displayValue}
        </span>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// HealthBadge — traffic-light badge for item health status
// ---------------------------------------------------------------------------

export type HealthStatus = "healthy" | "review" | "action"

interface HealthBadgeProps {
  status: HealthStatus
  className?: string
}

const healthConfig: Record<
  HealthStatus,
  { label: string; dotClass: string; bgClass: string; textClass: string }
> = {
  healthy: {
    label: "Healthy",
    dotClass: "bg-[var(--success)]",
    bgClass: "bg-[var(--success)]/10",
    textClass: "text-[var(--success)]",
  },
  review: {
    label: "Review",
    dotClass: "bg-[var(--warning)]",
    bgClass: "bg-[var(--warning)]/10",
    textClass: "text-[var(--warning)]",
  },
  action: {
    label: "Action Needed",
    dotClass: "bg-[var(--destructive)]",
    bgClass: "bg-[var(--destructive)]/10",
    textClass: "text-[var(--destructive)]",
  },
}

export function HealthBadge({ status, className }: HealthBadgeProps) {
  const config = healthConfig[status]

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        config.bgClass,
        config.textClass,
        className
      )}
    >
      <span className={cn("size-1.5 rounded-full", config.dotClass)} />
      {config.label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// AlphaDisplay — hero-sized reliability coefficient
// ---------------------------------------------------------------------------

interface AlphaDisplayProps {
  value: number | null
  label?: string
  size?: "sm" | "lg"
  className?: string
}

export function AlphaDisplay({
  value,
  label,
  size = "lg",
  className,
}: AlphaDisplayProps) {
  const display = value === null ? "—" : value.toFixed(2).replace(/^0/, "")

  const colorClass =
    value === null
      ? "text-muted-foreground"
      : value >= 0.80
        ? "text-[var(--success)]"
        : value >= 0.70
          ? "text-[var(--warning)]"
          : "text-[var(--destructive)]"

  return (
    <div className={cn("inline-flex flex-col items-center", className)}>
      <span
        className={cn(
          "font-heading font-bold leading-none tracking-tight tabular-nums",
          size === "lg" ? "text-4xl" : "text-2xl",
          colorClass,
        )}
      >
        {display}
      </span>
      {label && (
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mt-1">
          {label}
        </span>
      )}
    </div>
  )
}
