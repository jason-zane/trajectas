import { Suspense } from "react";
import {
  Users,
  PlayCircle,
  CheckCircle2,
  Megaphone,
  AlertTriangle,
} from "lucide-react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCampaignById } from "@/app/actions/campaigns";
import { notFound } from "next/navigation";
import { CampaignStatusActions } from "@/app/(dashboard)/campaigns/[id]/overview/campaign-status-actions";
import { CampaignAccessLinks } from "@/app/(dashboard)/campaigns/[id]/settings/campaign-access-links";

type Surface = "admin" | "client";

interface CampaignOverviewPageProps {
  campaignId: string;
  surface?: Surface;
  includeStatsSuspense?: boolean;
}

// Async component for stats/completion chart — the slow part (admin only)
async function CampaignStatsSection({ id }: { id: string }) {
  const campaign = await getCampaignById(id);
  if (!campaign) notFound();

  const totalParticipants = campaign.participants.length;
  const startedCount = campaign.participants.filter((c) =>
    ["in_progress", "completed"].includes(c.status),
  ).length;
  const completedCount = campaign.participants.filter(
    (c) => c.status === "completed",
  ).length;
  const completionPct =
    totalParticipants > 0 ? Math.round((completedCount / totalParticipants) * 100) : 0;

  return (
    <>
      {campaign.assessments.length === 0 && (
        <Alert variant="warning">
          <AlertTriangle className="size-4" />
          <AlertTitle>No assessments attached</AlertTitle>
          <AlertDescription>
            This campaign has no assessments. If you activate it now, participants will have nothing to complete.
          </AlertDescription>
        </Alert>
      )}

      {/* Stats row */}
      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard
          icon={Users}
          label="Invited"
          value={totalParticipants}
        />
        <StatCard
          icon={PlayCircle}
          label="Started"
          value={startedCount}
        />
        <StatCard
          icon={CheckCircle2}
          label="Completed"
          value={completedCount}
        />
        <StatCard
          icon={Megaphone}
          label="Assessments"
          value={campaign.assessments.length}
        />
      </div>

      {/* Completion bar */}
      {totalParticipants > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Overall Completion
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
              <span>
                {completedCount} of {totalParticipants} participants completed
              </span>
              <span className="font-medium text-foreground">
                {completionPct}%
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${completionPct}%` }}
              />
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}

// Skeleton fallback for the stats section
function StatsLoadingSkeleton() {
  return (
    <>
      {/* Stats row skeleton */}
      <div className="grid gap-4 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-xl bg-card p-6 shadow-sm ring-1 ring-foreground/[0.06]">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-muted" />
              <div className="space-y-1 flex-1">
                <div className="h-6 bg-muted rounded w-8" />
                <div className="h-3 bg-muted rounded w-16" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Completion bar skeleton */}
      <div className="rounded-xl bg-card p-6 shadow-sm ring-1 ring-foreground/[0.06]">
        <div className="h-4 bg-muted rounded w-32 mb-4" />
        <div className="space-y-3">
          <div className="h-3 bg-muted rounded w-full" />
          <div className="h-2 bg-muted rounded w-full" />
        </div>
      </div>
    </>
  );
}

// Synchronous stats section for client surface (no Suspense)
async function ClientStatsSectionSync({ campaignId }: { campaignId: string }) {
  const campaign = await getCampaignById(campaignId);
  if (!campaign) notFound();

  const totalParticipants = campaign.participants.length;
  const startedCount = campaign.participants.filter((c) =>
    ["in_progress", "completed"].includes(c.status),
  ).length;
  const completedCount = campaign.participants.filter(
    (c) => c.status === "completed",
  ).length;
  const completionPct =
    totalParticipants > 0
      ? Math.round((completedCount / totalParticipants) * 100)
      : 0;

  return (
    <>
      {campaign.assessments.length === 0 && (
        <Alert className="border-amber-500/30 bg-amber-500/[0.08] text-amber-900">
          <AlertTriangle className="size-4 text-amber-600" />
          <AlertTitle>No assessments attached</AlertTitle>
          <AlertDescription className="text-amber-800/90">
            This campaign has no assessments. If you activate it now, participants will have nothing to complete.
          </AlertDescription>
        </Alert>
      )}

      {/* Stats row */}
      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard icon={Users} label="Invited" value={totalParticipants} />
        <StatCard icon={PlayCircle} label="Started" value={startedCount} />
        <StatCard
          icon={CheckCircle2}
          label="Completed"
          value={completedCount}
        />
        <StatCard
          icon={Megaphone}
          label="Assessments"
          value={campaign.assessments.length}
        />
      </div>

      {/* Completion bar */}
      {totalParticipants > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Overall Completion
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
              <span>
                {completedCount} of {totalParticipants} participants completed
              </span>
              <span className="font-medium text-foreground">
                {completionPct}%
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${completionPct}%` }}
              />
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}

export async function CampaignOverviewPageComponent({
  campaignId,
  includeStatsSuspense = false,
}: CampaignOverviewPageProps) {
  // Fetch header only in the shared component to render actions immediately
  const campaign = await getCampaignById(campaignId);
  if (!campaign) notFound();

  return (
    <div className="space-y-6">
      {/* Status + quick actions — render immediately (already fast from cache) */}
      <CampaignStatusActions
        campaignId={campaign.id}
        campaignTitle={campaign.title}
        status={campaign.status}
        assessmentCount={campaign.assessments.length}
        pendingInviteCount={
          campaign.participants.filter((participant) => participant.status === "invited")
            .length
        }
        opensAt={campaign.opensAt}
        closesAt={campaign.closesAt}
      />

      {/* Stats + completion chart — render method varies by surface */}
      {includeStatsSuspense ? (
        <Suspense fallback={<StatsLoadingSkeleton />}>
          <CampaignStatsSection id={campaignId} />
        </Suspense>
      ) : (
        <ClientStatsSectionSync campaignId={campaignId} />
      )}

      {/* Access links */}
      <CampaignAccessLinks
        campaignId={campaign.id}
        links={campaign.accessLinks}
      />
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: number;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
            <Icon className="size-4 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-semibold">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
