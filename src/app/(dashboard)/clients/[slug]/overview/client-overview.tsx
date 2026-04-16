import Link from "next/link";
import {
  ArrowRight,
  ClipboardList,
  Megaphone,
  UserPlus,
} from "lucide-react";
import { EnterPortalButton } from "@/components/enter-portal-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollReveal } from "@/components/scroll-reveal";
import { ClientStats } from "./client-stats";
import type { Client } from "@/types/database";

interface ClientOverviewProps {
  client: Client;
  partnerName?: string;
  partnerSlug?: string;
  stats: {
    activeCampaignCount: number;
    totalParticipants: number;
    assignedAssessmentCount: number;
    reportsGenerated: number;
  };
  recentCampaigns: Array<{
    id: string;
    title: string;
    status: string;
    participantCount: number;
    completedCount: number;
  }>;
}

const statusVariant: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  active: "default",
  draft: "secondary",
  paused: "outline",
  archived: "outline",
  closed: "outline",
  failed: "destructive",
};

export function ClientOverview({ client, partnerName, partnerSlug, stats, recentCampaigns }: ClientOverviewProps) {
  const quickActions = [
    { title: "View Campaigns", href: `/clients/${client.slug}/campaigns`, icon: Megaphone, description: "Manage campaign activity" },
    { title: "Manage Assessments", href: `/clients/${client.slug}/assessments`, icon: ClipboardList, description: "Assessment assignments" },
    { title: "Invite User", href: `/clients/${client.slug}/users`, icon: UserPlus, description: "Add a team member" },
  ];

  return (
    <div className="space-y-8">
      {/* Stat Cards */}
      <ClientStats {...stats} clientSlug={client.slug} />

      {/* Key Context + Quick Actions */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Key Context */}
        <ScrollReveal delay={0} className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>Client Profile</CardTitle>
              <CardDescription>
                <Link
                  href={`/clients/${client.slug}/details`}
                  className="text-primary hover:underline"
                >
                  Edit details &rarr;
                </Link>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {client.industry && (
                <div>
                  <p className="text-caption text-muted-foreground">Industry</p>
                  <p className="text-sm">{client.industry}</p>
                </div>
              )}
              {client.sizeRange && (
                <div>
                  <p className="text-caption text-muted-foreground">Size Range</p>
                  <p className="text-sm">{client.sizeRange}</p>
                </div>
              )}
              {client.partnerId && (
                <div>
                  <p className="text-caption text-muted-foreground">Partner</p>
                  <p className="text-sm">
                    <Link
                      href={`/partners/${partnerSlug ?? client.partnerId}/overview`}
                      className="text-primary hover:underline"
                    >
                      {partnerName ?? "View partner"}
                    </Link>
                  </p>
                </div>
              )}
              {!client.industry && !client.sizeRange && !client.partnerId && (
                <p className="text-sm text-muted-foreground">
                  No profile details yet.{" "}
                  <Link href={`/clients/${client.slug}/details`} className="text-primary hover:underline">
                    Add details &rarr;
                  </Link>
                </p>
              )}
              <div>
                <p className="text-caption text-muted-foreground">Created</p>
                <p className="text-sm">
                  {new Date(client.created_at).toLocaleDateString(undefined, {
                    year: "numeric", month: "long", day: "numeric",
                  })}
                </p>
              </div>
            </CardContent>
          </Card>
        </ScrollReveal>

        {/* Quick Actions */}
        <ScrollReveal delay={60} className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <EnterPortalButton
                tenantType="client"
                tenantId={client.id}
                tenantName={client.name}
                variant="default"
              />
              <div className="space-y-1">
                {quickActions.map((action) => (
                  <Link
                    key={action.href}
                    href={action.href}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-muted group"
                  >
                    <action.icon className="size-4 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{action.title}</p>
                      <p className="text-caption text-muted-foreground truncate">{action.description}</p>
                    </div>
                    <ArrowRight className="size-3.5 text-muted-foreground opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </ScrollReveal>
      </div>

      {/* Recent Campaigns */}
      <ScrollReveal delay={120}>
        <Card>
          <CardHeader>
            <CardTitle>Recent Campaigns</CardTitle>
            <CardDescription>Latest campaign activity for this client</CardDescription>
          </CardHeader>
          <CardContent>
            {recentCampaigns.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No campaigns yet.
              </p>
            ) : (
              <div className="space-y-3">
                {recentCampaigns.map((campaign) => (
                  <div key={campaign.id} className="flex items-center justify-between gap-4 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{campaign.title}</p>
                    </div>
                    <Badge variant={statusVariant[campaign.status] ?? "outline"}>
                      {campaign.status}
                    </Badge>
                    <div className="text-right tabular-nums text-muted-foreground shrink-0">
                      <p>{campaign.participantCount} participants</p>
                      <p className="text-caption">{campaign.completedCount} completed</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </ScrollReveal>
    </div>
  );
}
