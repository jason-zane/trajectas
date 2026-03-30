import { Wallet, AlertCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface CreditsWidgetProps {
  credits: { totalCredits: number; totalUsage: number } | null
}

export function CreditsWidget({ credits }: CreditsWidgetProps) {
  if (credits === null) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground shrink-0">
        <AlertCircle className="size-3.5 shrink-0" />
        <span>
          Add <code className="font-mono text-[11px]">OPENROUTER_MANAGEMENT_KEY</code> to see credits
        </span>
      </div>
    )
  }

  const remaining = credits.totalCredits - credits.totalUsage
  const usedPct = credits.totalCredits > 0
    ? Math.min(100, (credits.totalUsage / credits.totalCredits) * 100)
    : 0
  const isLow = usedPct >= 80

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 shrink-0 shadow-xs">
      <div className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Wallet className="size-3.5" />
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">OpenRouter Credits</span>
          {isLow && (
            <Badge variant="outline" className="text-[10px] py-0 text-amber-600 border-amber-300 dark:border-amber-700">
              Low
            </Badge>
          )}
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-28 rounded-full bg-muted overflow-hidden">
            <div
              className={[
                "h-full rounded-full transition-all",
                isLow ? "bg-amber-500" : "bg-primary",
              ].join(" ")}
              style={{ width: `${usedPct.toFixed(1)}%` }}
            />
          </div>
          <span className="text-[11px] font-mono text-foreground">
            ${remaining.toFixed(2)} left
          </span>
        </div>

        <p className="text-[10px] text-muted-foreground">
          ${credits.totalUsage.toFixed(2)} used of ${credits.totalCredits.toFixed(2)}
        </p>
      </div>
    </div>
  )
}
