import Link from "next/link";
import {
  ArrowRight,
  Building2,
  ClipboardList,
  ExternalLink,
  Library,
  Megaphone,
  UserPlus,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollReveal } from "@/components/scroll-reveal";
import { TiltCard } from "@/components/tilt-card";
import { PartnerStats } from "./partner-stats";
import type { Partner } from "@/types/database";

interface PartnerOverviewProps {
  partner: Partner;
  stats: {
    clientCount: number;
    activeCampaignCount: number;
    partnerMemberCount: number;
    totalAssessmentsAssigned: number;
  };
  recentCampaigns: Array<{
    id: string;
    title: string;
    clientName: string;
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

export function PartnerOverview({ partner, stats, recentCampaigns }: PartnerOverviewProps) {
  const quickActions = [
    { title: "View Clients", href: `/partners/${partner.slug}/clients`, icon: Building2, description: "Manage client portfolio" },
    { title: "Manage Assessments", href: `/partners/${partner.slug}/assessments`, icon: ClipboardList, description: "Assessment assignments" },
    { title: "Manage Library", href: `/partners/${partner.slug}/library`, icon: Library, description: "Taxonomy entities" },
    { title: "Enter Portal", href: `/partner/dashboard`, icon: ExternalLink, description: "View as partner" },
    { title: "Invite User", href: `/partners/${partner.slug}/users`, icon: UserPlus, description: "Add a team member" },
  ];

  return (
    <div className="space-y-8">
      {/* Stat Cards */}
      <PartnerStats {...stats} partnerSlug={partner.slug} />

      {/* Key Context + Quick Actions */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Key Context */}
        <ScrollReveal delay={0} className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>Partner Profile</CardTitle>
              <CardDescription>
                <Link
                  href={`/partners/${partner.slug}/details`}
                  className="text-primary hover:underline"
                >
                  Edit details →
                </Link>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {partner.description && (
                <div>
                  <p className="text-caption text-muted-foreground">Description</p>
                  <p className="text-sm">{partner.description}</p>
                </div>
              )}
              {partner.website && (
                <div>
                  <p className="text-caption text-muted-foreground">Website</p>
                  <p className="text-sm">{partner.website}</p>
                </div>
              )}
              {partner.contactEmail && (
                <div>
                  <p className="text-caption text-muted-foreground">Contact</p>
                  <p className="text-sm">{partner.contactEmail}</p>
                </div>
              )}
              {partner.notes && (
                <div>
                  <p className="text-caption text-muted-foreground">Internal Notes</p>
                  <p className="text-sm text-muted-foreground">{partner.notes}</p>
                </div>
              )}
              {!partner.description && !partner.website && !partner.contactEmail && !partner.notes && (
                <p className="text-sm text-muted-foreground">
                  No profile details yet.{" "}
                  <Link href={`/partners/${partner.slug}/details`} className="text-primary hover:underline">
                    Add details →
                  </Link>
                </p>
              )}
              <div>
                <p className="text-caption text-muted-foreground">Created</p>
                <p className="text-sm">
                  {new Date(partner.created_at).toLocaleDateString(undefined, {
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
            <CardContent className="space-y-1">
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
            </CardContent>
          </Card>
        </ScrollReveal>
      </div>

      {/* Recent Campaigns */}
      <ScrollReveal delay={120}>
        <Card>
          <CardHeader>
            <CardTitle>Recent Campaigns</CardTitle>
            <CardDescription>Latest campaign activity across this partner&apos;s clients</CardDescription>
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
                      <p className="text-caption text-muted-foreground">{campaign.clientName}</p>
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
