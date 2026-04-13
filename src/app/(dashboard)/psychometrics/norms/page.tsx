import {
  Users,
  Globe,
  Building2,
  Briefcase,
  Calendar,
} from "lucide-react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/page-header"
import { EmptyState } from "@/components/empty-state"
import { ScrollReveal } from "@/components/scroll-reveal"
import { AnimatedNumber } from "@/components/animated-number"
import { getNormGroups } from "@/app/actions/psychometrics"
import { cn } from "@/lib/utils"

function normStatus(sampleSize: number) {
  if (sampleSize >= 200) {
    return {
      label: "Robust",
      dotClass: "bg-emerald-500",
      badgeBg:
        "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-semibold",
    }
  }
  if (sampleSize >= 100) {
    return {
      label: "Active",
      dotClass: "bg-emerald-500",
      badgeBg: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    }
  }
  return {
    label: "Building",
    dotClass: "bg-amber-500",
    badgeBg: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  }
}

function isGeneralPopulation(name: string) {
  return /general\s*population/i.test(name)
}

function formatDate(iso: string | null) {
  if (!iso) return null
  const d = new Date(iso)
  return d.toLocaleDateString("en-AU", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export default async function NormsPage() {
  const groups = await getNormGroups()

  const hasOnlyDefault =
    groups.length === 0 ||
    (groups.length === 1 && isGeneralPopulation(groups[0].name))
  const showEmpty = groups.length === 0 || hasOnlyDefault

  return (
    <div className="space-y-8 max-w-6xl">
      <PageHeader
        eyebrow="Psychometrics"
        title="Norm Explorer"
        description="Manage norm groups and reference populations for score interpretation."
      />

      {showEmpty ? (
        <EmptyState
          variant="default"
          title="Building your norm base"
          description="Norm data accumulates automatically as participants complete assessments. The General Population baseline is ready — specific norms (by industry, role level, region) will become available as your sample grows."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {groups.map((group, index) => {
            const status = normStatus(group.sampleSize)
            const isGP = isGeneralPopulation(group.name)

            return (
              <ScrollReveal key={group.id} delay={index * 60}>
                <Card
                  variant="interactive"
                  className={cn(
                    "border-l-[3px] border-l-primary",
                    isGP &&
                      "ring-1 ring-primary/20 shadow-[0_0_24px_var(--shadow-glow)]",
                  )}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "flex size-10 shrink-0 items-center justify-center rounded-xl transition-all duration-300 group-hover/card:shadow-[0_0_20px_var(--glow-color)]",
                            isGP
                              ? "bg-primary/15"
                              : "bg-primary/10",
                          )}
                          style={
                            {
                              "--glow-color": "var(--primary)",
                            } as React.CSSProperties
                          }
                        >
                          {isGP ? (
                            <Globe className="size-5 text-primary" />
                          ) : (
                            <Users className="size-5 text-primary" />
                          )}
                        </div>
                        <div>
                          <CardTitle
                            className={cn(
                              "text-title font-semibold",
                              isGP && "text-primary",
                            )}
                          >
                            {group.name}
                          </CardTitle>
                          {group.description && (
                            <CardDescription className="mt-0.5 line-clamp-2">
                              {group.description}
                            </CardDescription>
                          )}
                        </div>
                      </div>

                      {/* Status badge */}
                      <span
                        className={cn(
                          "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
                          status.badgeBg,
                        )}
                      >
                        <span
                          className={cn("size-1.5 rounded-full", status.dotClass)}
                        />
                        {status.label}
                      </span>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {/* Hero sample size */}
                    <div className="flex flex-col">
                      <span className="text-4xl font-semibold tabular-nums tracking-tight text-foreground leading-none">
                        <AnimatedNumber value={group.sampleSize} />
                      </span>
                      <span className="text-xs text-muted-foreground mt-1.5">
                        Sample size
                      </span>
                    </div>

                    {/* Building progress for small samples */}
                    {group.sampleSize < 100 && (
                      <div className="space-y-1">
                        <div className="h-1.5 w-full rounded-full bg-border overflow-hidden">
                          <div
                            className="h-full rounded-full bg-amber-500/70 transition-all duration-500"
                            style={{
                              width: `${Math.min((group.sampleSize / 100) * 100, 100)}%`,
                            }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {100 - group.sampleSize} more responses needed for
                          active status
                        </p>
                      </div>
                    )}

                    {/* Segmentation badges */}
                    <div className="flex flex-wrap gap-1.5">
                      {group.industry && (
                        <Badge variant="secondary">
                          <Building2 className="size-3" />
                          {group.industry}
                        </Badge>
                      )}
                      {group.roleLevel && (
                        <Badge variant="secondary">
                          <Briefcase className="size-3" />
                          {group.roleLevel}
                        </Badge>
                      )}
                      {group.region && (
                        <Badge variant="secondary">
                          <Globe className="size-3" />
                          {group.region}
                        </Badge>
                      )}
                    </div>

                    {/* Construct coverage + last refreshed */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border">
                      <span>
                        {group.constructCount}{" "}
                        {group.constructCount === 1
                          ? "construct"
                          : "constructs"}{" "}
                        with norms
                      </span>
                      {group.lastRefreshed && (
                        <span className="flex items-center gap-1">
                          <Calendar className="size-3" />
                          {formatDate(group.lastRefreshed)}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </ScrollReveal>
            )
          })}
        </div>
      )}
    </div>
  )
}
