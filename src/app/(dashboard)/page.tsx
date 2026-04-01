import Link from "next/link";
import {
  Brain,
  ClipboardList,
  Play,
  LayoutGrid,
  Dna,
  FileQuestion,
  ArrowRight,
  Sparkles,
  Building2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { AnimatedNumber } from "@/components/animated-number";
import { MiniBars } from "@/components/mini-bars";
import { ScrollReveal } from "@/components/scroll-reveal";
import { TiltCard } from "@/components/tilt-card";
import { getDashboardStats } from "@/app/actions/dashboard";

const statCards = [
  {
    key: "dimensions" as const,
    title: "Dimensions",
    icon: LayoutGrid,
    description: "Top-level groupings",
    href: "/dimensions",
    bgClass: "bg-dimension-bg",
    iconClass: "text-dimension-accent",
    accentClass: "bg-dimension-accent",
    glowColor: "var(--dimension-accent)",
  },
  {
    key: "factors" as const,
    title: "Factors",
    icon: Brain,
    description: "In your library",
    href: "/factors",
    bgClass: "bg-competency-bg",
    iconClass: "text-competency-accent",
    accentClass: "bg-competency-accent",
    glowColor: "var(--competency-accent)",
  },
  {
    key: "constructs" as const,
    title: "Constructs",
    icon: Dna,
    description: "Measurement constructs",
    href: "/constructs",
    bgClass: "bg-trait-bg",
    iconClass: "text-trait-accent",
    accentClass: "bg-trait-accent",
    glowColor: "var(--trait-accent)",
  },
  {
    key: "items" as const,
    title: "Items",
    icon: FileQuestion,
    description: "Assessment questions",
    href: "/items",
    bgClass: "bg-item-bg",
    iconClass: "text-item-accent",
    accentClass: "bg-item-accent",
    glowColor: "var(--item-accent)",
  },
  {
    key: "assessments" as const,
    title: "Assessments",
    icon: ClipboardList,
    description: "Active instruments",
    href: "/assessments",
    bgClass: "bg-muted",
    iconClass: "text-muted-foreground",
    accentClass: "bg-muted-foreground/30",
    glowColor: "var(--muted-foreground)",
  },
  {
    key: "organizations" as const,
    title: "Clients",
    icon: Building2,
    description: "Managed client accounts",
    href: "/directory",
    bgClass: "bg-muted",
    iconClass: "text-muted-foreground",
    accentClass: "bg-muted-foreground/30",
    glowColor: "var(--muted-foreground)",
  },
];

const quickActions = [
  {
    title: "Create Dimension",
    href: "/dimensions/create",
    icon: LayoutGrid,
    description: "Add a top-level factor grouping",
    bgClass: "bg-dimension-bg",
    iconClass: "text-dimension-accent",
  },
  {
    title: "Create Factor",
    href: "/factors/create",
    icon: Brain,
    description: "Define a new behavioural factor",
    bgClass: "bg-competency-bg",
    iconClass: "text-competency-accent",
  },
  {
    title: "Create Construct",
    href: "/constructs",
    icon: Dna,
    description: "Add a measurable construct",
    bgClass: "bg-trait-bg",
    iconClass: "text-trait-accent",
  },
  {
    title: "Build Assessment",
    href: "/assessments",
    icon: ClipboardList,
    description: "Design a new psychometric assessment",
    bgClass: "bg-muted",
    iconClass: "text-muted-foreground",
  },
  {
    title: "Start Diagnostic",
    href: "/diagnostics",
    icon: Play,
    description: "Launch a client diagnostic",
    bgClass: "bg-muted",
    iconClass: "text-muted-foreground",
  },
  {
    title: "Run AI Matching",
    href: "/matching",
    icon: Sparkles,
    description: "Match factors using AI",
    bgClass: "bg-muted",
    iconClass: "text-muted-foreground",
  },
];

export default async function DashboardPage() {
  const counts = await getDashboardStats();

  const today = new Date().toLocaleDateString("en-AU", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="space-y-12 max-w-6xl">
      {/* Hero */}
      <div className="animate-fade-in-up">
        <p className="text-overline text-primary mb-2">{today}</p>
        <h1 className="text-3xl md:text-display font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
          {(() => {
            const hour = new Date().getHours();
            if (hour < 12) return "Good morning";
            if (hour < 17) return "Good afternoon";
            return "Good evening";
          })()}
        </h1>
        <p className="text-body text-muted-foreground mt-2">
          Here&apos;s an overview of your assessment platform.
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {statCards.map((stat, index) => (
          <ScrollReveal key={stat.key} delay={index * 60}>
          <TiltCard>
          <Link href={stat.href}>
            <Card
              variant="interactive"
              className="relative overflow-hidden"
            >
              <CardContent className="pt-5 pb-4 px-5">
                <div className="flex items-start justify-between">
                  <div>
                    <AnimatedNumber
                      value={counts[stat.key]}
                      className="text-3xl font-bold tabular-nums"
                    />
                    <MiniBars color={stat.glowColor} />
                    <p className="text-caption text-muted-foreground mt-1">
                      {stat.title}
                    </p>
                  </div>
                  <div
                    className={`flex size-10 items-center justify-center rounded-xl ${stat.bgClass} transition-all duration-300 group-hover/card:shadow-[0_0_20px_var(--glow-color)]`}
                    style={{ "--glow-color": stat.glowColor } as React.CSSProperties}
                  >
                    <stat.icon className={`size-5 ${stat.iconClass}`} />
                  </div>
                </div>
              </CardContent>
              <div className={`h-[2px] ${stat.accentClass} opacity-50`} />
            </Card>
          </Link>
          </TiltCard>
          </ScrollReveal>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-title font-semibold tracking-tight mb-5">
          Quick Actions
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {quickActions.map((action, index) => (
            <ScrollReveal key={action.href + action.title} delay={index * 60}>
            <TiltCard>
            <Link href={action.href}>
              <Card
                variant="interactive"
              >
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
