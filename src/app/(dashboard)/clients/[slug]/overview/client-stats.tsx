import Link from "next/link";
import { ClipboardList, FileText, Megaphone, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { AnimatedNumber } from "@/components/animated-number";
import { MiniBars } from "@/components/mini-bars";
import { ScrollReveal } from "@/components/scroll-reveal";
import { TiltCard } from "@/components/tilt-card";

type ClientStatsProps = {
  activeCampaignCount: number;
  totalParticipants: number;
  assignedAssessmentCount: number;
  reportsGenerated: number;
  clientSlug: string;
};

const statCards = [
  { key: "activeCampaignCount" as const, title: "Active Campaigns", icon: Megaphone, segment: null },
  { key: "totalParticipants" as const, title: "Participants", icon: Users, segment: null },
  { key: "assignedAssessmentCount" as const, title: "Assessments Assigned", icon: ClipboardList, segment: "assessments" },
  { key: "reportsGenerated" as const, title: "Reports Generated", icon: FileText, segment: "reports" },
];

export function ClientStats(props: ClientStatsProps) {
  const glowColor = "var(--muted-foreground)";

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {statCards.map((stat, index) => {
        const content = (
          <ScrollReveal key={stat.key} delay={index * 60}>
            <TiltCard>
              <Card variant="interactive" className="relative overflow-hidden">
                <CardContent className="pt-5 pb-4 px-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <AnimatedNumber
                        value={props[stat.key]}
                        className="text-3xl font-bold tabular-nums"
                      />
                      <MiniBars color={glowColor} />
                      <p className="text-caption text-muted-foreground mt-1">
                        {stat.title}
                      </p>
                    </div>
                    <div
                      className="flex size-10 items-center justify-center rounded-xl bg-muted transition-all duration-300 group-hover/card:shadow-[0_0_20px_var(--glow-color)]"
                      style={{ "--glow-color": glowColor } as React.CSSProperties}
                    >
                      <stat.icon className="size-5 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
                <div className="h-[2px] bg-muted-foreground/30 opacity-50" />
              </Card>
            </TiltCard>
          </ScrollReveal>
        );

        if (stat.segment) {
          return (
            <Link key={stat.key} href={`/clients/${props.clientSlug}/${stat.segment}`}>
              {content}
            </Link>
          );
        }
        return <div key={stat.key}>{content}</div>;
      })}
    </div>
  );
}
