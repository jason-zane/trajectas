"use client"

import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

interface IndicatorsTabProps {
  indicatorsLow: string
  indicatorsMid: string
  indicatorsHigh: string
  onChangeLow: (value: string) => void
  onChangeMid: (value: string) => void
  onChangeHigh: (value: string) => void
}

function parseLines(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
}

function IndicatorPreview({
  lines,
  color,
}: {
  lines: string[]
  color: "red" | "amber" | "green"
}) {
  if (lines.length === 0) return null

  const dotColor = {
    red: "bg-red-500/70 dark:bg-red-400/70",
    amber: "bg-amber-500/70 dark:bg-amber-400/70",
    green: "bg-emerald-500/70 dark:bg-emerald-400/70",
  }[color]

  return (
    <ul className="mt-2 space-y-1">
      {lines.map((line, i) => (
        <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
          <span className={`mt-1.5 size-1.5 shrink-0 rounded-full ${dotColor}`} />
          {line}
        </li>
      ))}
    </ul>
  )
}

export function IndicatorsTab({
  indicatorsLow,
  indicatorsMid,
  indicatorsHigh,
  onChangeLow,
  onChangeMid,
  onChangeHigh,
}: IndicatorsTabProps) {
  return (
    <div className="space-y-8">
      <p className="text-sm text-muted-foreground">
        Define observable behaviours at each performance level. Enter one
        indicator per line.
      </p>

      {/* Low */}
      <div className="space-y-2">
        <Label htmlFor="indicators-low" className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-red-500/70 dark:bg-red-400/70" />
          Low Performance
        </Label>
        <Textarea
          id="indicators-low"
          name="indicatorsLow"
          placeholder="Struggles to identify relevant information&#10;Relies heavily on others for direction&#10;Shows limited awareness of impact"
          value={indicatorsLow}
          onChange={(e) => onChangeLow(e.target.value)}
          className="min-h-28 border-l-2 border-l-red-500/30"
        />
        <IndicatorPreview lines={parseLines(indicatorsLow)} color="red" />
      </div>

      {/* Mid */}
      <div className="space-y-2">
        <Label htmlFor="indicators-mid" className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-amber-500/70 dark:bg-amber-400/70" />
          Mid Performance
        </Label>
        <Textarea
          id="indicators-mid"
          name="indicatorsMid"
          placeholder="Demonstrates competence in routine situations&#10;Applies standard approaches effectively&#10;Contributes constructively in teams"
          value={indicatorsMid}
          onChange={(e) => onChangeMid(e.target.value)}
          className="min-h-28 border-l-2 border-l-amber-500/30"
        />
        <IndicatorPreview lines={parseLines(indicatorsMid)} color="amber" />
      </div>

      {/* High */}
      <div className="space-y-2">
        <Label htmlFor="indicators-high" className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-emerald-500/70 dark:bg-emerald-400/70" />
          High Performance
        </Label>
        <Textarea
          id="indicators-high"
          name="indicatorsHigh"
          placeholder="Consistently exceeds expectations&#10;Proactively identifies and resolves challenges&#10;Role-models behaviours for others"
          value={indicatorsHigh}
          onChange={(e) => onChangeHigh(e.target.value)}
          className="min-h-28 border-l-2 border-l-emerald-500/30"
        />
        <IndicatorPreview lines={parseLines(indicatorsHigh)} color="green" />
      </div>
    </div>
  )
}
