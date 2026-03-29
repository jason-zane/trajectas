import Link from "next/link";
import {
  Activity,
  FileQuestion,
  Dna,
  BarChart3,
  Shield,
  Clock,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AnimatedNumber } from "@/components/animated-number";
import { MiniBars } from "@/components/mini-bars";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { ScrollReveal } from "@/components/scroll-reveal";
import { TiltCard } from "@/components/tilt-card";
import { getPsychometricOverview } from "@/app/actions/psychometrics";

/* ------------------------------------------------------------------ */
/*  Readiness checks                                                   */
/* ------------------------------------------------------------------ */

type ReadinessStatus = "green" | "amber" | "red";

interface ReadinessCheck {
  label: string;
  description: string;
  status: ReadinessStatus;
}

function deriveReadiness(
  overview: Awaited<ReturnType<typeof getPsychometricOverview>>
): ReadinessCheck[] {
  const itemQuality: ReadinessCheck = (() => {
    if (overview.activeItems === 0)
      return {
        label: "Item Quality",
        description: "No active items in your library yet",
        status: "red" as const,
      };
    if (overview.flaggedItems > 0)
      return {
        label: "Item Quality",
        description: `${overview.flaggedItems} item${overview.flaggedItems === 1 ? "" : "s"} flagged for review`,
        status: "amber" as const,
      };
    return {
      label: "Item Quality",
      description: "All items within acceptable parameters",
      status: "green" as const,
    };
  })();

  const scaleReliability: ReadinessCheck = (() => {
    if (overview.constructCount === 0)
      return {
        label: "Scale Reliability",
        description: "No constructs defined yet",
        status: "red" as const,
      };
    if (overview.reliableConstructs < overview.constructCount)
      return {
        label: "Scale Reliability",
        description: `${overview.reliableConstructs} of ${overview.constructCount} constructs meet \u03B1 \u2265 .70`,
        status: "amber" as const,
      };
    return {
      label: "Scale Reliability",
      description: `All ${overview.constructCount} constructs meet \u03B1 \u2265 .70`,
      status: "green" as const,
    };
  })();

  const normData: ReadinessCheck = (() => {
    if (overview.normGroupCount === 0)
      return {
        label: "Norm Data",
        description: "No norm groups established",
        status: "red" as const,
      };
    if (overview.normGroupCount < 3)
      return {
        label: "Norm Data",
        description: `${overview.normGroupCount} norm group${overview.normGroupCount === 1 ? "" : "s"} \u2014 consider adding more for coverage`,
        status: "amber" as const,
      };
    return {
      label: "Norm Data",
      description: `${overview.normGroupCount} active norm groups`,
      status: "green" as const,
    };
  })();

  const difScreening: ReadinessCheck = (() => {
    if (overview.calibrationRuns === 0)
      return {
        label: "DIF Screening",
        description: "No calibration runs completed yet",
        status: "red" as const,
      };
    if (overview.flaggedItems > 0)
      return {
        label: "DIF Screening",
        description: "Flagged items may indicate differential functioning",
        status: "amber" as const,
      };
    return {
      label: "DIF Screening",
      description: "No differential item functioning detected",
      status: "green" as const,
    };
  })();

  return [itemQuality, scaleReliability, normData, difScreening];
}

const statusIcon: Record<ReadinessStatus, typeof CheckCircle2> = {
  green: CheckCircle2,
  amber: AlertTriangle,
  red: AlertCircle,
};

const statusColor: Record<ReadinessStatus, string> = {
  green: "text-emerald-500",
  amber: "text-amber-500",
  red: "text-destructive",
};

const statusBorderColor: Record<ReadinessStatus, string> = {
  green: "border-l-emerald-500",
  amber: "border-l-amber-500",
  red: "border-l-destructive",
};

/* ------------------------------------------------------------------ */
/*  Stat card config                                                   */
/* ------------------------------------------------------------------ */

type StatCardConfig = {
  key: string;
  title: string;
  icon: typeof Activity;
  href?: string;
  bgClass: string;
  iconClass: string;
  accentClass: string;
  glowColor: string;
  getValue: (o: Awaited<ReturnType<typeof getPsychometricOverview>>) => number | string;
  getDescription?: (o: Awaited<ReturnType<typeof getPsychometricOverview>>) => string;
  isNumeric: boolean;
  badgeVariant?: "destructive" | "default";
};

const statCards: StatCardConfig[] = [
  {
    key: "activeItems",
    title: "Active Items",
    icon: FileQuestion,
    href: "/psychometrics/items",
    bgClass: "bg-item-bg",
    iconClass: "text-item-accent",
    accentClass: "bg-item-accent",
    glowColor: "var(--item-accent)",
    getValue: (o) => o.activeItems,
    getDescription: (o) => `${o.totalItems} total in library`,
    isNumeric: true,
  },
  {
    key: "flaggedItems",
    title: "Flagged Items",
    icon: AlertTriangle,
    bgClass: "bg-destructive/10",
    iconClass: "text-destructive",
    accentClass: "bg-destructive",
    glowColor: "var(--destructive)",
    getValue: (o) => o.flaggedItems,
    getDescription: () => "Requiring review",
    isNumeric: true,
    badgeVariant: "destructive",
  },
  {
    key: "reliableConstructs",
    title: "Reliable Constructs",
    icon: Dna,
    bgClass: "bg-trait-bg",
    iconClass: "text-trait-accent",
    accentClass: "bg-trait-accent",
    glowColor: "var(--trait-accent)",
    getValue: (o) => o.reliableConstructs,
    getDescription: (o) => `of ${o.constructCount} total constructs`,
    isNumeric: true,
  },
  {
    key: "calibrationRuns",
    title: "Calibration Runs",
    icon: Activity,
    href: "/psychometrics/calibrations",
    bgClass: "bg-competency-bg",
    iconClass: "text-competency-accent",
    accentClass: "bg-competency-accent",
    glowColor: "var(--competency-accent)",
    getValue: (o) => o.calibrationRuns,
    getDescription: () => "Completed analyses",
    isNumeric: true,
  },
  {
    key: "normGroups",
    title: "Norm Groups",
    icon: BarChart3,
    href: "/psychometrics/norms",
    bgClass: "bg-dimension-bg",
    iconClass: "text-dimension-accent",
    accentClass: "bg-dimension-accent",
    glowColor: "var(--dimension-accent)",
    getValue: (o) => o.normGroupCount,
    getDescription: () => "Active reference groups",
    isNumeric: true,
  },
  {
    key: "lastCalibration",
    title: "Last Calibration",
    icon: Clock,
    bgClass: "bg-muted",
    iconClass: "text-muted-foreground",
    accentClass: "bg-muted-foreground/30",
    glowColor: "var(--muted-foreground)",
    getValue: (o) =>
      o.lastCalibrationDate
        ? new Date(o.lastCalibrationDate).toLocaleDateString("en-AU", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })
        : "Never",
    getDescription: () => "Most recent analysis",
    isNumeric: false,
  },
];

/* ------------------------------------------------------------------ */
/*  Quick links                                                        */
/* ------------------------------------------------------------------ */

const quickLinks = [
  {
    title: "View Item Health",
    href: "/psychometrics/items",
    icon: FileQuestion,
    description: "Inspect difficulty, discrimination & flag status per item",
    bgClass: "bg-item-bg",
    iconClass: "text-item-accent",
  },
  {
    title: "View Reliability",
    href: "/psychometrics/reliability",
    icon: Shield,
    description: "Cronbach\u2019s \u03B1, omega, split-half & SEM by construct",
    bgClass: "bg-trait-bg",
    iconClass: "text-trait-accent",
  },
  {
    title: "Explore Norms",
    href: "/psychometrics/norms",
    icon: BarChart3,
    description: "Norm groups, percentile tables & reference data",
    bgClass: "bg-dimension-bg",
    iconClass: "text-dimension-accent",
  },
];

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default async function PsychometricsPage() {
  const overview = await getPsychometricOverview();
  const readiness = deriveReadiness(overview);

  const hasCalibrationData = overview.calibrationRuns > 0;

  return (
    <div className="space-y-12 max-w-6xl">
      {/* Header */}
      <PageHeader
        eyebrow="Psychometrics"
        title="Psychometric Dashboard"
        description="Monitor item quality, scale reliability, and norm data across your assessment library."
      />

      {/* Empty state — shown when no calibration runs exist */}
      {!hasCalibrationData && (
        <ScrollReveal>
          <EmptyState
            title="No psychometric analyses yet"
            description="Run your first calibration after collecting participant responses. The platform will compute item quality metrics, scale reliability, and norm data automatically."
          />
        </ScrollReveal>
      )}

      {/* Readiness Checklist — shown when calibration data exists */}
      {hasCalibrationData && (
        <ScrollReveal delay={60}>
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>Assessment Readiness</CardTitle>
              <CardDescription>
                Status checks across the four pillars of psychometric quality
              </CardDescription>
            </CardHeader>
            <CardContent className="pb-5">
              <div className="grid gap-2">
                {readiness.map((check) => {
                  const Icon = statusIcon[check.status];
                  return (
                    <div
                      key={check.label}
                      className={`flex items-center gap-4 rounded-lg border-l-[3px] bg-muted/40 px-4 py-3 transition-colors ${statusBorderColor[check.status]}`}
                    >
                      <Icon
                        className={`size-5 shrink-0 ${statusColor[check.status]}`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{check.label}</p>
                        <p className="text-caption text-muted-foreground">
                          {check.description}
                        </p>
                      </div>
                      <Badge
                        variant={
                          check.status === "green"
                            ? "default"
                            : check.status === "amber"
                              ? "secondary"
                              : "destructive"
                        }
                      >
                        {check.status === "green"
                          ? "Pass"
                          : check.status === "amber"
                            ? "Review"
                            : "Action"}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </ScrollReveal>
      )}

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {statCards.map((stat, index) => {
          const value = stat.getValue(overview);
          const desc = stat.getDescription?.(overview);

          const inner = (
            <Card variant="interactive" className="relative overflow-hidden">
              <CardContent className="pt-5 pb-4 px-5">
                <div className="flex items-start justify-between">
                  <div>
                    {stat.isNumeric ? (
                      <AnimatedNumber
                        value={value as number}
                        className="text-3xl font-bold tabular-nums"
                      />
                    ) : (
                      <span className="text-2xl font-bold tracking-tight">
                        {value}
                      </span>
                    )}
                    <MiniBars color={stat.glowColor} />
                    <p className="text-caption text-muted-foreground mt-1">
                      {stat.title}
                    </p>
                    {desc && (
                      <p className="text-caption text-muted-foreground/70 mt-0.5">
                        {desc}
                      </p>
                    )}
                  </div>
                  <div
                    className={`flex size-10 items-center justify-center rounded-xl ${stat.bgClass} transition-all duration-300 group-hover/card:shadow-[0_0_20px_var(--glow-color)]`}
                    style={
                      { "--glow-color": stat.glowColor } as React.CSSProperties
                    }
                  >
                    <stat.icon className={`size-5 ${stat.iconClass}`} />
                  </div>
                </div>
              </CardContent>
              <div className={`h-[2px] ${stat.accentClass} opacity-50`} />
            </Card>
          );

          return (
            <ScrollReveal key={stat.key} delay={index * 60}>
              <TiltCard>
                {stat.href ? <Link href={stat.href}>{inner}</Link> : inner}
              </TiltCard>
            </ScrollReveal>
          );
        })}
      </div>

      {/* Quick Links */}
      <div>
        <h2 className="text-title font-semibold tracking-tight mb-5">
          Quick Links
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {quickLinks.map((action, index) => (
            <ScrollReveal key={action.href} delay={index * 60}>
              <TiltCard>
                <Link href={action.href}>
                  <Card variant="interactive">
                    <CardContent className="py-4 px-5">
                      <div className="flex items-center gap-4">
                        <div
                          className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${action.bgClass} transition-colors`}
                        >
                          <action.icon
                            className={`size-5 ${action.iconClass}`}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{action.title}</p>
                          <p className="text-caption text-muted-foreground truncate">
                            {action.description}
                          </p>
                        </div>
                        <ArrowRight className="size-4 text-muted-foreground opacity-0 -translate-x-1 group-hover/card:opacity-100 group-hover/card:translate-x-0 transition-all" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </TiltCard>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </div>
  );
}
