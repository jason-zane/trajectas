import Link from "next/link";
import {
  Building2,
  Megaphone,
  Users,
  CheckCircle2,
  ClipboardList,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AnimatedNumber } from "@/components/animated-number";
import { MiniBars } from "@/components/mini-bars";
import { ScrollReveal } from "@/components/scroll-reveal";
import { TiltCard } from "@/components/tilt-card";
import { getClients } from "@/app/actions/clients";
import { getCampaigns } from "@/app/actions/campaigns";

const glowColor = "var(--muted-foreground)";

const quickActions = [
  {
    title: "View Clients",
    href: "/partner/clients",
    icon: Building2,
    description: "Browse your client portfolio",
  },
  {
    title: "Review Campaigns",
    href: "/partner/campaigns",
    icon: Megaphone,
    description: "Monitor campaign progress",
  },
  {
    title: "View Participants",
    href: "/partner/participants",
    icon: Users,
    description: "Track participant outcomes",
  },
  {
    title: "View Assessments",
    href: "/partner/assessments",
    icon: ClipboardList,
    description: "Browse deployed assessments",
  },
];

function statusBadgeVariant(status: string) {
  switch (status) {
    case "active":
    case "completed":
      return "default" as const;
    case "draft":
    case "pending":
      return "secondary" as const;
    case "paused":
    case "archived":
    case "closed":
      return "outline" as const;
    case "failed":
      return "destructive" as const;
    default:
      return "secondary" as const;
  }
}

export default async function PartnerDashboardPage() {
  const [clients, campaigns] = await Promise.all([getClients(), getCampaigns()]);

  const participantCount = campaigns.reduce(
    (sum, campaign) => sum + campaign.participantCount,
    0
  );
  const completedCount = campaigns.reduce(
    (sum, campaign) => sum + campaign.completedCount,
    0
  );

  const today = new Date().toLocaleDateString("en-AU", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  })();

  const statCards = [
    {
      key: "clients",
      title: "Clients",
      value: clients.length,
      icon: Building2,
      href: "/partner/clients",
    },
    {
      key: "campaigns",
      title: "Campaigns",
      value: campaigns.length,
      icon: Megaphone,
      href: "/partner/campaigns",
    },
    {
      key: "participants",
      title: "Participants",
      value: participantCount,
      icon: Users,
      href: "/partner/participants",
    },
    {
      key: "completed",
      title: "Completed",
      value: completedCount,
      icon: CheckCircle2,
      href: "/partner/participants",
    },
  ];

  const recentCampaigns = [...campaigns]
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    .slice(0, 5);

  return (
    <div className="space-y-12 max-w-6xl">
      {/* Hero */}
      <div className="animate-fade-in-up">
        <p className="text-overline text-primary mb-2">{today}</p>
        <h1 className="text-3xl md:text-display font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
          {greeting}
        </h1>
        <p className="text-body text-muted-foreground mt-2">
          Here&apos;s an overview of your partner workspace.
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat, index) => (
          <ScrollReveal key={stat.key} delay={index * 60}>
            <TiltCard>
              <Link href={stat.href}>
                <Card variant="interactive" className="relative overflow-hidden">
                  <CardContent className="pt-5 pb-4 px-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <AnimatedNumber
                          value={stat.value}
                          className="text-3xl font-bold tabular-nums"
                        />
                        <MiniBars color={glowColor} />
                        <p className="text-caption text-muted-foreground mt-1">
                          {stat.title}
                        </p>
                      </div>
                      <div
                        className="flex size-10 items-center justify-center rounded-xl bg-muted transition-all duration-300 group-hover/card:shadow-[0_0_20px_var(--glow-color)]"
                        style={
                          {
                            "--glow-color": glowColor,
                          } as React.CSSProperties
                        }
                      >
                        <stat.icon className="size-5 text-muted-foreground" />
                      </div>
                    </div>
                  </CardContent>
                  <div className="h-[2px] bg-muted-foreground/30 opacity-50" />
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
            <ScrollReveal key={action.href} delay={index * 60}>
              <TiltCard>
                <Link href={action.href}>
                  <Card variant="interactive">
                    <CardContent className="py-4 px-5">
                      <div className="flex items-center gap-4">
                        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted transition-colors">
                          <action.icon className="size-5 text-muted-foreground" />
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

      {/* Recent Campaigns */}
      <div>
        <Card>
          <CardHeader>
            <CardTitle>Recent campaigns</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentCampaigns.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No campaigns are visible in this workspace yet.
              </p>
            ) : (
              recentCampaigns.map((campaign) => (
                <div
                  key={campaign.id}
                  className="flex items-start justify-between gap-4 rounded-lg border border-border/70 px-4 py-3"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/partner/campaigns/${campaign.id}`}
                      className="font-semibold hover:text-primary transition-colors"
                    >
                      {campaign.title}
                    </Link>
                    <p className="text-caption text-muted-foreground mt-0.5">
                      {campaign.clientName || "Client not set"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Badge variant={statusBadgeVariant(campaign.status)}>
                      {campaign.status}
                    </Badge>
                    <span className="text-caption text-muted-foreground whitespace-nowrap">
                      {campaign.participantCount} / {campaign.completedCount} completed
                    </span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
