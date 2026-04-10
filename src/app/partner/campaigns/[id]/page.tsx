import Link from "next/link";
import {
  ArrowLeft,
  ClipboardList,
  ExternalLink,
  Megaphone,
  Users,
} from "lucide-react";
import { getCampaignById } from "@/app/actions/campaigns";
import { resolveWorkspaceAccess } from "@/lib/auth/workspace-access";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(value?: string) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function statusBadgeVariant(status: string) {
  switch (status) {
    case "active":
    case "completed":
      return "default";
    case "draft":
    case "pending":
      return "secondary";
    case "paused":
    case "archived":
    case "closed":
      return "outline";
    case "failed":
      return "destructive";
    default:
      return "outline";
  }
}

function MetricCard({
  label,
  value,
  description,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-4 py-5">
        <div>
          <p className="text-3xl font-semibold tracking-tight">{value}</p>
          <p className="mt-1 text-sm font-medium">{label}</p>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
        <div className="flex size-10 items-center justify-center rounded-xl bg-muted">
          <Icon className="size-5 text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function PartnerCampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [campaign, access] = await Promise.all([
    getCampaignById(id),
    resolveWorkspaceAccess("partner"),
  ]);

  const canExportReports = access.status === "ok" && access.canExportReports;

  const backLink = (
    <Link
      href="/partner/campaigns"
      className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
    >
      <ArrowLeft className="size-4" />
      Back to campaigns
    </Link>
  );

  if (!campaign) {
    return (
      <div className="space-y-8 max-w-6xl">
        <PageHeader eyebrow="Campaigns" title="Campaign detail">
          {backLink}
        </PageHeader>
        <Card>
          <CardHeader>
            <CardTitle>Campaign not available</CardTitle>
            <CardDescription>Campaign not found.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Build description: use campaign.description or fallback to client + dates
  const fallbackDescription = [
    campaign.clientName ? campaign.clientName : null,
    campaign.opensAt ? `Opens ${formatDate(campaign.opensAt)}` : null,
    campaign.closesAt ? `Closes ${formatDate(campaign.closesAt)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const pageDescription = campaign.description || fallbackDescription || undefined;

  return (
    <div className="space-y-8 max-w-6xl">
      <PageHeader
        eyebrow={campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
        title={campaign.title}
        description={pageDescription}
      >
        <div className="flex flex-wrap gap-3">
          {backLink}
          <Link
            href={`/partner/campaigns/${campaign.id}/results`}
            className="inline-flex items-center rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            Results
          </Link>
          <Link
            href="/partner/participants"
            className="inline-flex items-center rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            View participants
          </Link>
        </div>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard
          label="Status"
          value={campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
          description={`Opens ${formatDate(campaign.opensAt)}`}
          icon={Megaphone}
        />
        <MetricCard
          label="Assessments"
          value={campaign.assessments.length}
          description="Deployed in this campaign"
          icon={ClipboardList}
        />
        <MetricCard
          label="Participants"
          value={campaign.participants.length}
          description="Currently enrolled"
          icon={Users}
        />
        <MetricCard
          label="Access links"
          value={campaign.accessLinks.length}
          description="Runtime entry points"
          icon={ExternalLink}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <CardTitle>Assessment lineup</CardTitle>
            <CardDescription>Assessments in this campaign</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {campaign.assessments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No assessments attached yet.</p>
            ) : (
              campaign.assessments.map((assessment) => (
                <div
                  key={assessment.id}
                  className="flex items-center justify-between rounded-lg border border-border/70 px-4 py-3"
                >
                  <div>
                    <p className="font-medium">{assessment.assessmentTitle}</p>
                    <p className="text-xs text-muted-foreground">
                      Display order {assessment.displayOrder}
                    </p>
                  </div>
                  <Badge variant={statusBadgeVariant(assessment.assessmentStatus)}>
                    {assessment.assessmentStatus}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Participants</CardTitle>
            <CardDescription>Participants enrolled in this campaign</CardDescription>
          </CardHeader>
          <CardContent>
            {campaign.participants.length === 0 ? (
              <p className="text-sm text-muted-foreground">No participants enrolled yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Participant</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Invited</TableHead>
                    <TableHead>Completed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaign.participants.map((participant) => {
                    const label =
                      participant.firstName || participant.lastName
                        ? `${participant.firstName ?? ""} ${participant.lastName ?? ""}`.trim()
                        : participant.email;

                    return (
                      <TableRow key={participant.id}>
                        <TableCell>
                          <div className="space-y-1">
                            <Link
                              href={`/partner/campaigns/${campaign.id}/participants/${participant.id}`}
                              className="inline-flex items-center gap-1 font-medium transition-colors hover:text-primary"
                            >
                              {label}
                              <ExternalLink className="size-3.5 opacity-60" />
                            </Link>
                            <p className="text-xs text-muted-foreground">{participant.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusBadgeVariant(participant.status)}>
                            {participant.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDate(participant.invitedAt)}</TableCell>
                        <TableCell>
                          <div className="flex items-center justify-between gap-3">
                            <span>{formatDate(participant.completedAt)}</span>
                            {participant.status === "completed" ? (
                              <div className="flex items-center gap-3">
                                <Link
                                  href={`/partner/reports/participants/${participant.id}`}
                                  className="inline-flex items-center gap-1 text-xs font-medium text-primary transition-colors hover:text-primary/80"
                                >
                                  Open report
                                  <ExternalLink className="size-3" />
                                </Link>
                                {canExportReports ? (
                                  <Link
                                    href={`/partner/exports/participants/${participant.id}`}
                                    className="inline-flex items-center gap-1 text-xs font-medium text-foreground transition-colors hover:text-primary"
                                  >
                                    Export
                                    <ExternalLink className="size-3" />
                                  </Link>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
