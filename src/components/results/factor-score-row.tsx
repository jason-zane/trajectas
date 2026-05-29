"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react"
import {
  getConstructScoresForFactor,
  type ConstructDrilldownRow,
  type SessionDetailScore,
} from "@/app/actions/sessions"

interface FactorScoreRowProps {
  score: SessionDetailScore
  sessionId: string
  /** When false the row renders without the drilldown affordance. */
  enableDrilldown: boolean
}

export function FactorScoreRow({
  score,
  sessionId,
  enableDrilldown,
}: FactorScoreRowProps) {
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<ConstructDrilldownRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const pct = Math.max(0, Math.min(100, score.scaledScore))
  const value = Math.round(score.scaledScore)

  async function toggle() {
    if (expanded) {
      setExpanded(false)
      return
    }
    setExpanded(true)
    if (rows !== null) return
    setLoading(true)
    setError(null)
    try {
      const data = await getConstructScoresForFactor(sessionId, score.entityId)
      setRows(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load constructs")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="flex items-center gap-4 py-1">
        {enableDrilldown ? (
          <button
            type="button"
            onClick={toggle}
            className="-ml-1 inline-flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground"
            aria-label={expanded ? "Hide constructs" : "Show constructs"}
            aria-expanded={expanded}
          >
            {expanded ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronRight className="size-3.5" />
            )}
          </button>
        ) : null}
        <span
          className={`shrink-0 truncate text-sm ${enableDrilldown ? "w-[12rem]" : "w-52"}`}
        >
          {score.entityName}
        </span>
        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="w-10 shrink-0 text-right text-sm font-semibold tabular-nums">
          {value}
        </span>
      </div>

      {expanded && enableDrilldown && (
        <div className="ml-6 border-l border-border/60 pl-4 pb-2 pt-1 space-y-1.5">
          {loading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
              <Loader2 className="size-3 animate-spin" />
              Loading constructs…
            </div>
          )}
          {error && (
            <p className="py-1 text-xs text-destructive">{error}</p>
          )}
          {!loading && !error && rows && rows.length === 0 && (
            <p className="py-1 text-xs text-muted-foreground">
              No constructs linked to this factor.
            </p>
          )}
          {!loading && !error && rows && rows.length > 0 && (
            <>
              {rows.map((row) => {
                const cPct = Math.max(0, Math.min(100, row.scaledScore))
                const cVal = Math.round(row.scaledScore)
                return (
                  <div key={row.constructId} className="flex items-center gap-3 py-1">
                    <span className="w-[10.5rem] shrink-0 truncate text-xs text-muted-foreground">
                      {row.constructName}
                    </span>
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-muted-foreground/40"
                        style={{ width: `${cPct}%` }}
                      />
                    </div>
                    <span className="w-7 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                      {row.itemCount === 0 ? "—" : cVal}
                    </span>
                  </div>
                )
              })}
              <p className="pt-1 text-[10px] uppercase tracking-wider text-muted-foreground/70">
                Platform-admin drill-down · computed from item responses
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
