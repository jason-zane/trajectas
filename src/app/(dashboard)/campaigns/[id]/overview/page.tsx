import {
  Users,
  PlayCircle,
  CheckCircle2,
  Megaphone,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCampaignById } from "@/app/actions/campaigns";
import { notFound } from "next/navigation";
import { CampaignStatusActions } from "./campaign-status-actions";

export default async function CampaignOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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
    <div className="space-y-6">
      {/* Status + quick actions */}
      <CampaignStatusActions
        campaignId={campaign.id}
        status={campaign.status}
      />

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

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 text-sm">
            <TimelineItem
              label="Created"
              date={campaign.created_at}
            />
            {campaign.opensAt && (
              <TimelineItem
                label="Opens"
                date={campaign.opensAt}
                future
              />
            )}
            {campaign.closesAt && (
              <TimelineItem
                label="Closes"
                date={campaign.closesAt}
                future
              />
            )}
          </div>
        </CardContent>
      </Card>
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

function TimelineItem({
  label,
  date,
  future,
}: {
  label: string;
  date: string;
  future?: boolean;
}) {
  const d = new Date(date);
  const formatted = d.toLocaleDateString("en-AU", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="flex items-center gap-3">
      <div
        className={`size-2 rounded-full ${future ? "bg-muted-foreground/40" : "bg-primary"}`}
      />
      <span className="text-muted-foreground w-20">{label}</span>
      <span className={future ? "text-muted-foreground" : ""}>{formatted}</span>
    </div>
  );
}
