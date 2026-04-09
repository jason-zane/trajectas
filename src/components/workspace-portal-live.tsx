import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  Calendar,
  Building2,
  Check,
  ClipboardList,
  ExternalLink,
  Layers,
  Loader2,
  Mail,
  Megaphone,
  Timer,
  ShieldCheck,
  Sparkles,
  Users,
  XCircle,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { getWorkspaceAssessmentSummaries } from "@/app/actions/assessments";
import { getCampaignById, getCampaigns } from "@/app/actions/campaigns";
import {
  getDiagnosticRespondents,
  getDiagnosticSessionDetail,
  getDiagnosticSessions,
  getClientsForDiagnosticSelect,
} from "@/app/actions/diagnostics";
import { getWorkspaceMatchingRuns } from "@/app/actions/matching";
import { getClients } from "@/app/actions/clients";
import {
  getParticipant,
  getParticipantActivity,
  getParticipants,
  getParticipantSessions,
} from "@/app/actions/participants";
import { PageHeader } from "@/components/page-header";
import { WorkspacePortalPage } from "@/components/workspace-portal-page";
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
import type { WorkspaceAccessResult } from "@/lib/auth/workspace-access";
import type { WorkspacePortalPageConfig } from "@/lib/workspace-portal-config";
import { applyRoutePrefix, type WorkspaceSurface } from "@/lib/surfaces";

type SupportedPageKey =
  | ""
  | "clients"
  | "assessments"
  | "campaigns"
  | "diagnostics"
  | "results"
  | "matching";

interface WorkspacePortalLivePageProps {
  access: WorkspaceAccessResult;
  config: WorkspacePortalPageConfig;
  routePrefix: string;
  surface: Extract<WorkspaceSurface, "partner" | "client">;
  pageKey: string;
}

function getParticipantReportHref(routePrefix: string, participantId: string) {
  return applyRoutePrefix(routePrefix, `/reports/participants/${participantId}`);
}

function getParticipantExportHref(routePrefix: string, participantId: string) {
  return applyRoutePrefix(routePrefix, `/exports/participants/${participantId}`);
}

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

const matchingStatusConfig: Record<
  string,
  {
    label: string
    icon: typeof CheckCircle2
    variant: "default" | "secondary" | "outline" | "destructive"
  }
> = {
  pending: { label: "Pending", icon: Clock, variant: "secondary" },
  running: { label: "Running", icon: Loader2, variant: "default" },
  completed: { label: "Completed", icon: CheckCircle2, variant: "outline" },
  failed: { label: "Failed", icon: XCircle, variant: "destructive" },
}

function HeaderActions({
  config,
  routePrefix,
}: {
  config: WorkspacePortalPageConfig;
  routePrefix: string;
}) {
  if (!config.primaryAction && !config.secondaryAction) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-3">
      {config.primaryAction ? (
        <Link
          href={applyRoutePrefix(routePrefix, config.primaryAction.href)}
          className="inline-flex items-center rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          {config.primaryAction.label}
        </Link>
      ) : null}
      {config.secondaryAction ? (
        <Link
          href={applyRoutePrefix(routePrefix, config.secondaryAction.href)}
          className="inline-flex items-center rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          {config.secondaryAction.label}
        </Link>
      ) : null}
    </div>
  );
}

function WorkspaceAccessCard({ access }: { access: WorkspaceAccessResult }) {
  const selectedContext = access.isLocalDevelopmentBypass
    ? access.previewContext
    : access.activeContext;
  const contextHeading = access.isLocalDevelopmentBypass
    ? "Preview scope"
    : "Active context";
  const contextLabel = selectedContext?.tenantType
    ? `${selectedContext.tenantType}:${selectedContext.tenantId ?? "unknown"}`
    : access.isLocalDevelopmentBypass
      ? "Preview all accessible data"
      : "Global workspace scope";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="size-4" />
          Workspace scope
        </CardTitle>
        <CardDescription>
          This portal is rendering through the new tenant-aware access layer.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 text-sm text-muted-foreground md:grid-cols-4">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground/70">Actor</p>
          <p className="mt-1 font-medium text-foreground">
            {access.actor?.email ?? "Local development bypass"}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground/70">{contextHeading}</p>
          <p className="mt-1 font-medium text-foreground">{contextLabel}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground/70">Accessible partners</p>
          <p className="mt-1 font-medium text-foreground">{access.accessiblePartnerCount}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground/70">Accessible clients</p>
          <div className="mt-1 flex items-center gap-2">
            <span className="font-medium text-foreground">{access.accessibleClientCount}</span>
            {access.hasSupportSession ? (
              <Badge variant="outline">Support session</Badge>
            ) : null}
            {access.isLocalDevelopmentBypass ? (
              <Badge variant="secondary">Local preview</Badge>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MetricCard({
  label,
  value,
  description,
  icon: Icon,
}: {
  label: string;
  value: number;
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

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
    </Card>
  );
}

function formatDateTime(value?: string) {
  if (!value) return "Not set";

  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDuration(start?: string, end?: string) {
  if (!start || !end) return null;

  const minutes = Math.max(
    0,
    Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000)
  );

  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

async function WorkspaceOverview({
  access,
  config,
  routePrefix,
  surface,
}: {
  access: WorkspaceAccessResult;
  config: WorkspacePortalPageConfig;
  routePrefix: string;
  surface: Extract<WorkspaceSurface, "partner" | "client">;
}) {
  const [clients, campaigns, diagnostics] = await Promise.all([
    getClients(),
    getCampaigns(),
    getDiagnosticSessions(),
  ]);

  const participantCount = campaigns.reduce((sum, campaign) => sum + campaign.participantCount, 0);
  const completedParticipants = campaigns.reduce((sum, campaign) => sum + campaign.completedCount, 0);
  const activeDiagnostics = diagnostics.filter((session) => session.status === "active").length;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={config.eyebrow}
        title={config.title}
        description={config.description}
      >
        <HeaderActions config={config} routePrefix={routePrefix} />
      </PageHeader>

      <WorkspaceAccessCard access={access} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {surface === "partner" ? (
          <MetricCard
            label="Assigned clients"
            value={clients.length}
            description="Accessible through partner scope"
            icon={Building2}
          />
        ) : null}
        <MetricCard
          label="Campaigns"
          value={campaigns.length}
          description="Currently visible in this portal"
          icon={ClipboardList}
        />
        <MetricCard
          label="Participants"
          value={participantCount}
          description={`${completedParticipants} completed so far`}
          icon={Users}
        />
        <MetricCard
          label="Diagnostics"
          value={diagnostics.length}
          description={`${activeDiagnostics} active sessions`}
          icon={Layers}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        {surface === "partner" ? (
          <Card>
            <CardHeader>
              <CardTitle>Client portfolio</CardTitle>
              <CardDescription>Client scope available through the current partner context.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {clients.slice(0, 6).map((client) => (
                <div key={client.id} className="flex items-center justify-between rounded-lg border border-border/70 px-4 py-3">
                  <div>
                    <p className="font-medium">{client.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {client.industry || "Industry not set"}
                      {client.sizeRange ? ` • ${client.sizeRange}` : ""}
                    </p>
                  </div>
                  <Badge variant={client.isActive ? "default" : "outline"}>
                    {client.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
              ))}
              {clients.length === 0 ? (
                <p className="text-sm text-muted-foreground">No clients are accessible in the current scope yet.</p>
              ) : null}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Client boundary</CardTitle>
              <CardDescription>This portal stays inside the currently accessible client scope.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                The client surface now resolves campaigns, diagnostics, and reporting through the same
                membership-based access layer as the rest of the platform.
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{access.accessibleClientCount} accessible client scope(s)</Badge>
                <Badge variant="outline">{campaigns.length} campaigns</Badge>
                <Badge variant="outline">{diagnostics.length} diagnostic sessions</Badge>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Recent campaign activity</CardTitle>
            <CardDescription>Newest visible campaigns across the active workspace scope.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {campaigns.slice(0, 6).map((campaign) => (
              <div key={campaign.id} className="flex items-start justify-between gap-4 rounded-lg border border-border/70 px-4 py-3">
                <div>
                  <Link
                    href={applyRoutePrefix(routePrefix, `/campaigns/${campaign.id}`)}
                    className="inline-flex items-center gap-1 font-medium transition-colors hover:text-primary"
                  >
                    {campaign.title}
                    <ExternalLink className="size-3.5 opacity-60" />
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {campaign.clientName || "Client not set"} • {campaign.participantCount} participants
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={statusBadgeVariant(campaign.status)}>{campaign.status}</Badge>
                  <span className="text-xs text-muted-foreground">{campaign.completedCount} complete</span>
                </div>
              </div>
            ))}
            {campaigns.length === 0 ? (
              <p className="text-sm text-muted-foreground">No campaigns are visible in this workspace yet.</p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

async function WorkspaceClientsPage({
  access,
  config,
  routePrefix,
}: {
  access: WorkspaceAccessResult;
  config: WorkspacePortalPageConfig;
  routePrefix: string;
}) {
  const clients = await getClients();

  return (
    <div className="space-y-8">
      <PageHeader eyebrow={config.eyebrow} title={config.title} description={config.description}>
        <HeaderActions config={config} routePrefix={routePrefix} />
      </PageHeader>

      <WorkspaceAccessCard access={access} />

      <Card>
        <CardHeader>
          <CardTitle>Accessible clients</CardTitle>
          <CardDescription>Only clients granted through partner scope are listed here.</CardDescription>
        </CardHeader>
        <CardContent>
          {clients.length === 0 ? (
            <EmptyState
              title="No clients available"
              description="Partner memberships are wired, but there are no accessible clients in the current context yet."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Industry</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Campaigns</TableHead>
                  <TableHead>Diagnostics</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{client.name}</p>
                        <p className="text-xs text-muted-foreground">{client.slug}</p>
                      </div>
                    </TableCell>
                    <TableCell>{client.industry || "Not set"}</TableCell>
                    <TableCell>{client.sizeRange || "Not set"}</TableCell>
                    <TableCell>{client.assessmentCount}</TableCell>
                    <TableCell>{client.sessionCount}</TableCell>
                    <TableCell>
                      <Badge variant={client.isActive ? "default" : "outline"}>
                        {client.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

async function WorkspaceCampaignsPage({
  access,
  config,
  routePrefix,
}: {
  access: WorkspaceAccessResult;
  config: WorkspacePortalPageConfig;
  routePrefix: string;
}) {
  const campaigns = await getCampaigns();

  return (
    <div className="space-y-8">
      <PageHeader eyebrow={config.eyebrow} title={config.title} description={config.description}>
        <HeaderActions config={config} routePrefix={routePrefix} />
      </PageHeader>

      <WorkspaceAccessCard access={access} />

      <Card>
        <CardHeader>
          <CardTitle>Campaigns in scope</CardTitle>
          <CardDescription>Campaign visibility is enforced through client and partner memberships.</CardDescription>
        </CardHeader>
        <CardContent>
          {campaigns.length === 0 ? (
            <EmptyState
              title="No campaigns available"
              description="There are no visible campaigns in the current workspace scope yet."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Assessments</TableHead>
                  <TableHead>Participants</TableHead>
                  <TableHead>Completed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((campaign) => (
                  <TableRow key={campaign.id}>
                    <TableCell>
                      <div>
                        <Link
                          href={applyRoutePrefix(routePrefix, `/campaigns/${campaign.id}`)}
                          className="inline-flex items-center gap-1 font-medium transition-colors hover:text-primary"
                        >
                          {campaign.title}
                          <ExternalLink className="size-3.5 opacity-60" />
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          Opens {formatDate(campaign.opensAt)} • Closes {formatDate(campaign.closesAt)}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>{campaign.clientName || "Not set"}</TableCell>
                    <TableCell>
                      <Badge variant={statusBadgeVariant(campaign.status)}>{campaign.status}</Badge>
                    </TableCell>
                    <TableCell>{campaign.assessmentCount}</TableCell>
                    <TableCell>{campaign.participantCount}</TableCell>
                    <TableCell>{campaign.completedCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

async function WorkspaceCampaignDetailPage({
  access,
  config,
  routePrefix,
  campaignId,
}: {
  access: WorkspaceAccessResult;
  config: WorkspacePortalPageConfig;
  routePrefix: string;
  campaignId: string;
}) {
  const campaign = await getCampaignById(campaignId);

  if (!campaign) {
    return (
      <div className="space-y-8">
        <PageHeader eyebrow={config.eyebrow} title="Campaign detail" description="Campaign scope is enforced through the same tenant-aware access layer.">
          <Link
            href={applyRoutePrefix(routePrefix, "/campaigns")}
            className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            <ArrowLeft className="size-4" />
            Back to campaigns
          </Link>
        </PageHeader>
        <WorkspaceAccessCard access={access} />
        <EmptyState
          title="Campaign not available"
          description="This campaign is either outside the current workspace scope or no longer exists."
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={config.eyebrow}
        title={campaign.title}
        description={campaign.description || "Campaign detail is scoped through client and partner memberships."}
      >
        <div className="flex flex-wrap gap-3">
          <Link
            href={applyRoutePrefix(routePrefix, "/campaigns")}
            className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            <ArrowLeft className="size-4" />
            Back to campaigns
          </Link>
          <Link
            href={applyRoutePrefix(routePrefix, "/results")}
            className="inline-flex items-center rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            View results
          </Link>
        </div>
      </PageHeader>

      <WorkspaceAccessCard access={access} />

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard
          label="Status"
          value={campaign.status === "active" ? 1 : 0}
          description={campaign.status}
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
          description="Currently visible in this scope"
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
            <CardDescription>
              These assessments are currently deployed inside this campaign.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {campaign.assessments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No assessments are attached to this campaign yet.</p>
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
            <CardDescription>
              Participant visibility is scoped through the same campaign access boundary.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {campaign.participants.length === 0 ? (
              <p className="text-sm text-muted-foreground">No participants are visible for this campaign yet.</p>
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
                              href={applyRoutePrefix(
                                routePrefix,
                                `/campaigns/${campaign.id}/participants/${participant.id}`
                              )}
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
                                  href={getParticipantReportHref(routePrefix, participant.id)}
                                  className="inline-flex items-center gap-1 text-xs font-medium text-primary transition-colors hover:text-primary/80"
                                >
                                  Open report
                                  <ExternalLink className="size-3" />
                                </Link>
                                {access.canExportReports ? (
                                  <Link
                                    href={getParticipantExportHref(routePrefix, participant.id)}
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

async function WorkspaceParticipantDetailPage({
  access,
  config,
  routePrefix,
  campaignId,
  participantId,
}: {
  access: WorkspaceAccessResult;
  config: WorkspacePortalPageConfig;
  routePrefix: string;
  campaignId: string;
  participantId: string;
}) {
  const [participant, sessions, activity] = await Promise.all([
    getParticipant(participantId),
    getParticipantSessions(participantId),
    getParticipantActivity(participantId),
  ]);

  if (!participant || participant.campaignId !== campaignId) {
    return (
      <div className="space-y-8">
        <PageHeader eyebrow={config.eyebrow} title="Participant detail" description="Participant access remains campaign-scoped and token-separated from the runtime.">
          <Link
            href={applyRoutePrefix(routePrefix, `/campaigns/${campaignId}`)}
            className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            <ArrowLeft className="size-4" />
            Back to campaign
          </Link>
        </PageHeader>
        <WorkspaceAccessCard access={access} />
        <EmptyState
          title="Participant not available"
          description="This participant is either outside the current workspace scope or no longer exists."
        />
      </div>
    );
  }

  const displayName =
    participant.firstName || participant.lastName
      ? `${participant.firstName ?? ""} ${participant.lastName ?? ""}`.trim()
      : participant.email;
  const completedSessions = sessions.filter((session) => session.status === "completed").length;
  const totalDuration = formatDuration(participant.startedAt, participant.completedAt);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={config.eyebrow}
        title={displayName}
        description="Participant detail is visible here because it belongs to the active campaign and workspace scope."
      >
        <div className="flex flex-wrap gap-3">
          <Link
            href={applyRoutePrefix(routePrefix, `/campaigns/${campaignId}`)}
            className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            <ArrowLeft className="size-4" />
            Back to campaign
          </Link>
          {participant.status === "completed" ? (
            <>
              <Link
                href={getParticipantReportHref(routePrefix, participant.id)}
                className="inline-flex items-center rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                Open participant report
              </Link>
              {access.canExportReports ? (
                <Link
                  href={getParticipantExportHref(routePrefix, participant.id)}
                  className="inline-flex items-center rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                >
                  Export report
                </Link>
              ) : null}
            </>
          ) : null}
        </div>
      </PageHeader>

      <WorkspaceAccessCard access={access} />

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard
          label="Assessments completed"
          value={completedSessions}
          description={`${sessions.length} session(s) in total`}
          icon={Check}
        />
        <MetricCard
          label="Total time"
          value={totalDuration ? 1 : 0}
          description={totalDuration ?? "Not completed yet"}
          icon={Timer}
        />
        <MetricCard
          label="Activity events"
          value={activity.length}
          description="Auditable milestones in this participant journey"
          icon={Activity}
        />
        <MetricCard
          label="Status"
          value={participant.status === "completed" ? 1 : 0}
          description={participant.status}
          icon={Users}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Participant overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground/70">Email</p>
              <p className="font-medium">{participant.email}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground/70">Campaign</p>
              <p className="font-medium">{participant.campaignTitle}</p>
            </div>
            {participant.clientName ? (
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground/70">Client</p>
                <p className="font-medium">{participant.clientName}</p>
              </div>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-border/70 p-3">
                <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-muted-foreground/70">
                  <Mail className="size-3.5" />
                  Invited
                </div>
                <p className="font-medium">{formatDateTime(participant.invitedAt)}</p>
              </div>
              <div className="rounded-lg border border-border/70 p-3">
                <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-muted-foreground/70">
                  <Calendar className="size-3.5" />
                  Completed
                </div>
                <p className="font-medium">{formatDateTime(participant.completedAt)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Assessment sessions</CardTitle>
            <CardDescription>
              Session visibility stays bounded to the participant and campaign you are authorised to view.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {sessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No assessment sessions are visible yet.</p>
            ) : (
              sessions.map((session) => (
                <div
                  key={session.id}
                  className="rounded-lg border border-border/70 px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{session.assessmentTitle}</p>
                      <p className="text-xs text-muted-foreground">
                        Started {formatDateTime(session.startedAt)} • Completed {formatDateTime(session.completedAt)}
                      </p>
                    </div>
                    <Badge variant={statusBadgeVariant(session.status)}>{session.status}</Badge>
                  </div>
                  {session.scores.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {session.scores.slice(0, 4).map((score) => (
                        <Badge key={`${session.id}-${score.factorId}`} variant="outline">
                          {score.factorName}: {Math.round(score.scaledScore)}
                        </Badge>
                      ))}
                      {session.scores.length > 4 ? (
                        <Badge variant="secondary">+{session.scores.length - 4} more</Badge>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Activity timeline</CardTitle>
          <CardDescription>
            Milestones across invite, progress, and completion inside this campaign.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity has been recorded yet.</p>
          ) : (
            activity.map((event, index) => (
              <div
                key={`${event.type}-${event.timestamp}-${index}`}
                className="flex items-start gap-3 rounded-lg border border-border/70 px-4 py-3"
              >
                <div className="mt-0.5 flex size-8 items-center justify-center rounded-full bg-muted">
                  <Activity className="size-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{event.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(event.timestamp)}
                    {event.detail ? ` • ${event.detail}` : ""}
                  </p>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

async function WorkspaceAssessmentsPage({
  access,
  config,
  routePrefix,
}: {
  access: WorkspaceAccessResult;
  config: WorkspacePortalPageConfig;
  routePrefix: string;
}) {
  const assessments = await getWorkspaceAssessmentSummaries();
  const activeAssessments = assessments.filter((assessment) => assessment.status === "active").length;
  const deployedCampaigns = assessments.reduce((sum, assessment) => sum + assessment.campaignCount, 0);
  const clientScopeCount = new Set(
    assessments.flatMap((assessment) => assessment.clientNames)
  ).size;

  return (
    <div className="space-y-8">
      <PageHeader eyebrow={config.eyebrow} title={config.title} description={config.description}>
        <HeaderActions config={config} routePrefix={routePrefix} />
      </PageHeader>

      <WorkspaceAccessCard access={access} />

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Assessments in scope"
          value={assessments.length}
          description="Visible through the current workspace boundary"
          icon={ClipboardList}
        />
        <MetricCard
          label="Active"
          value={activeAssessments}
          description="Currently deployable assessments"
          icon={Sparkles}
        />
        <MetricCard
          label="Campaign deployments"
          value={deployedCampaigns}
          description={`${clientScopeCount} client scope(s) currently using them`}
          icon={Building2}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Assessments currently in use</CardTitle>
          <CardDescription>
            This view shows campaign-linked assessments available inside the current client boundary.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {assessments.length === 0 ? (
            <EmptyState
              title="No assessments visible yet"
              description="No assessments are currently deployed inside this workspace scope."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Assessment</TableHead>
                  <TableHead>Client scope</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Campaigns</TableHead>
                  <TableHead>Participants</TableHead>
                  <TableHead>Completed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assessments.map((assessment) => (
                  <TableRow key={assessment.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="font-medium">{assessment.title}</p>
                        {assessment.description ? (
                          <p className="line-clamp-2 text-xs text-muted-foreground">
                            {assessment.description}
                          </p>
                        ) : null}
                        {assessment.campaignTitles.length > 0 ? (
                          <p className="text-xs text-muted-foreground">
                            In {assessment.campaignTitles.slice(0, 2).join(", ")}
                            {assessment.campaignTitles.length > 2
                              ? ` +${assessment.campaignTitles.length - 2} more`
                              : ""}
                          </p>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      {assessment.clientNames.length === 0
                        ? "Not set"
                        : assessment.clientNames.length === 1
                          ? assessment.clientNames[0]
                          : `${assessment.clientNames.length} clients`}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusBadgeVariant(assessment.status)}>{assessment.status}</Badge>
                    </TableCell>
                    <TableCell>{assessment.campaignCount}</TableCell>
                    <TableCell>{assessment.participantCount}</TableCell>
                    <TableCell>{assessment.completedCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

async function WorkspaceDiagnosticsPage({
  access,
  config,
  routePrefix,
}: {
  access: WorkspaceAccessResult;
  config: WorkspacePortalPageConfig;
  routePrefix: string;
}) {
  const [diagnostics, availableClients] = await Promise.all([
    getDiagnosticSessions(),
    getClientsForDiagnosticSelect(),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader eyebrow={config.eyebrow} title={config.title} description={config.description}>
        <HeaderActions config={config} routePrefix={routePrefix} />
      </PageHeader>

      <WorkspaceAccessCard access={access} />

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Diagnostic sessions"
          value={diagnostics.length}
          description="Visible inside the current scope"
          icon={Layers}
        />
        <MetricCard
          label="Clients ready"
          value={availableClients.length}
          description="Eligible for new diagnostic sessions"
          icon={Building2}
        />
        <MetricCard
          label="Completed"
          value={diagnostics.filter((session) => session.status === "completed").length}
          description="Finished diagnostic sessions"
          icon={Sparkles}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Diagnostic sessions</CardTitle>
          <CardDescription>These sessions are now filtered through the authorised client boundary.</CardDescription>
        </CardHeader>
        <CardContent>
          {diagnostics.length === 0 ? (
            <EmptyState
              title="No diagnostic sessions available"
              description="No diagnostics are visible in this scope yet."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Session</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Template</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Respondents</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {diagnostics.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell>
                      <div>
                        <Link
                          href={applyRoutePrefix(routePrefix, `/diagnostics/${session.id}`)}
                          className="inline-flex items-center gap-1 font-medium transition-colors hover:text-primary"
                        >
                          {session.title}
                          <ExternalLink className="size-3.5 opacity-60" />
                        </Link>
                        <p className="text-xs text-muted-foreground">{formatDate(session.created_at)}</p>
                      </div>
                    </TableCell>
                    <TableCell>{session.clientName}</TableCell>
                    <TableCell>{session.templateName}</TableCell>
                    <TableCell>
                      <Badge variant={statusBadgeVariant(session.status)}>{session.status}</Badge>
                    </TableCell>
                    <TableCell>{session.respondentCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

async function WorkspaceDiagnosticDetailPage({
  access,
  config,
  routePrefix,
  sessionId,
  surface,
  resultsMode = false,
}: {
  access: WorkspaceAccessResult;
  config: WorkspacePortalPageConfig;
  routePrefix: string;
  sessionId: string;
  surface: Extract<WorkspaceSurface, "partner" | "client">;
  resultsMode?: boolean;
}) {
  const [session, respondents] = await Promise.all([
    getDiagnosticSessionDetail(sessionId),
    getDiagnosticRespondents(sessionId),
  ]);

  const backHref = resultsMode ? "/diagnostic-results" : "/diagnostics";

  if (!session) {
    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow={config.eyebrow}
          title="Diagnostic session detail"
          description="Diagnostic visibility remains scoped through the active client boundary."
        >
          <Link
            href={applyRoutePrefix(routePrefix, backHref)}
            className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            <ArrowLeft className="size-4" />
            Back
          </Link>
        </PageHeader>
        <WorkspaceAccessCard access={access} />
        <EmptyState
          title="Diagnostic session not available"
          description="This diagnostic session is either outside the current workspace scope or no longer exists."
        />
      </div>
    );
  }

  const completedRespondents = respondents.filter(
    (respondent) => respondent.status === "completed"
  ).length;
  const totalResponses = respondents.reduce(
    (sum, respondent) => sum + respondent.responseCount,
    0
  );

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={config.eyebrow}
        title={session.title}
        description={
          session.description ||
          `${session.templateName} for ${session.clientName}`
        }
      >
        <div className="flex flex-wrap gap-3">
          <Link
            href={applyRoutePrefix(routePrefix, backHref)}
            className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            <ArrowLeft className="size-4" />
            Back
          </Link>
          {resultsMode || surface !== "client" || session.status !== "completed" ? null : (
            <Link
              href={applyRoutePrefix(routePrefix, `/diagnostic-results/${session.id}`)}
              className="inline-flex items-center rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Open result view
            </Link>
          )}
        </div>
      </PageHeader>

      <WorkspaceAccessCard access={access} />

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard
          label="Respondents"
          value={respondents.length}
          description="Visible in the current workspace scope"
          icon={Users}
        />
        <MetricCard
          label="Completed"
          value={completedRespondents}
          description={`${Math.max(0, respondents.length - completedRespondents)} pending`}
          icon={CheckCircle2}
        />
        <MetricCard
          label="Responses"
          value={totalResponses}
          description="Captured rating rows across respondents"
          icon={ClipboardList}
        />
        <MetricCard
          label="Snapshots"
          value={session.snapshotCount}
          description="Stored result snapshots"
          icon={Sparkles}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Session overview</CardTitle>
            <CardDescription>
              This diagnostic session is rendered through the same tenant-aware access layer as the rest of the portal.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-border/70 p-3">
                <div className="mb-1 text-xs uppercase tracking-[0.16em] text-muted-foreground/70">
                  Client
                </div>
                <p className="font-medium">{session.clientName}</p>
              </div>
              <div className="rounded-lg border border-border/70 p-3">
                <div className="mb-1 text-xs uppercase tracking-[0.16em] text-muted-foreground/70">
                  Template
                </div>
                <p className="font-medium">{session.templateName}</p>
              </div>
              <div className="rounded-lg border border-border/70 p-3">
                <div className="mb-1 text-xs uppercase tracking-[0.16em] text-muted-foreground/70">
                  Status
                </div>
                <Badge variant={statusBadgeVariant(session.status)}>{session.status}</Badge>
              </div>
              <div className="rounded-lg border border-border/70 p-3">
                <div className="mb-1 text-xs uppercase tracking-[0.16em] text-muted-foreground/70">
                  Department
                </div>
                <p className="font-medium">{session.department || "Not set"}</p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-border/70 p-3">
                <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-muted-foreground/70">
                  <Calendar className="size-3.5" />
                  Created
                </div>
                <p className="font-medium">{formatDateTime(session.created_at)}</p>
              </div>
              <div className="rounded-lg border border-border/70 p-3">
                <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-muted-foreground/70">
                  <Timer className="size-3.5" />
                  Started
                </div>
                <p className="font-medium">{formatDateTime(session.startedAt)}</p>
              </div>
              <div className="rounded-lg border border-border/70 p-3">
                <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-muted-foreground/70">
                  <CheckCircle2 className="size-3.5" />
                  Completed
                </div>
                <p className="font-medium">{formatDateTime(session.completedAt)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Respondents</CardTitle>
            <CardDescription>
              Respondent visibility remains inside the authorised client boundary for this session.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {respondents.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No respondents are visible for this diagnostic session yet.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Respondent</TableHead>
                    <TableHead>Relationship</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Responses</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {respondents.map((respondent) => (
                    <TableRow key={respondent.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{respondent.name}</p>
                          <p className="text-xs text-muted-foreground">{respondent.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p>{respondent.relationship}</p>
                          {respondent.roleTitle ? (
                            <p className="text-xs text-muted-foreground">{respondent.roleTitle}</p>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>{respondent.department || "Not set"}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge
                            variant={
                              respondent.status === "completed" ? "default" : "secondary"
                            }
                          >
                            {respondent.status}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {respondent.completedAt
                              ? `Completed ${formatDate(respondent.completedAt)}`
                              : `Invited ${formatDate(respondent.created_at)}`}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{respondent.responseCount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

async function WorkspaceResultsPage({
  access,
  config,
  routePrefix,
  diagnosticsOnly = false,
  surface,
}: {
  access: WorkspaceAccessResult;
  config: WorkspacePortalPageConfig;
  routePrefix: string;
  diagnosticsOnly?: boolean;
  surface: Extract<WorkspaceSurface, "partner" | "client">;
}) {
  const [campaigns, diagnostics, completedParticipants] = await Promise.all([
    diagnosticsOnly ? Promise.resolve([]) : getCampaigns(),
    getDiagnosticSessions(),
    diagnosticsOnly
      ? Promise.resolve({ data: [], total: 0 })
      : getParticipants({ status: "completed", perPage: 12 }),
  ]);

  const campaignsWithResults = campaigns.filter((campaign) => campaign.completedCount > 0);
  const showDiagnosticsSection = surface !== "client" && !diagnosticsOnly;
  const completedDiagnostics = showDiagnosticsSection
    ? diagnostics.filter((session) => session.status === "completed")
    : [];

  return (
    <div className="space-y-8">
      <PageHeader eyebrow={config.eyebrow} title={config.title} description={config.description}>
        <HeaderActions config={config} routePrefix={routePrefix} />
      </PageHeader>

      <WorkspaceAccessCard access={access} />

      {!diagnosticsOnly ? (
        <div className="grid gap-4 xl:grid-cols-[1fr_1.05fr]">
          <Card>
            <CardHeader>
              <CardTitle>Assessment results in scope</CardTitle>
              <CardDescription>Campaigns with at least one completed participant in the visible workspace.</CardDescription>
            </CardHeader>
            <CardContent>
              {campaignsWithResults.length === 0 ? (
                <EmptyState
                  title="No assessment results yet"
                  description="Visible campaigns do not have completed participant results yet."
                />
              ) : (
                <div className="space-y-3">
                  {campaignsWithResults.map((campaign) => (
                    <div key={campaign.id} className="flex items-center justify-between rounded-lg border border-border/70 px-4 py-3">
                      <div>
                        <Link
                          href={applyRoutePrefix(routePrefix, `/campaigns/${campaign.id}`)}
                          className="inline-flex items-center gap-1 font-medium transition-colors hover:text-primary"
                        >
                          {campaign.title}
                          <ExternalLink className="size-3.5 opacity-60" />
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {campaign.clientName || "Client not set"} • {campaign.completedCount} completed
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={statusBadgeVariant(campaign.status)}>{campaign.status}</Badge>
                        <span className="text-xs text-muted-foreground">{campaign.assessmentCount} assessments</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Participant reports in scope</CardTitle>
              <CardDescription>
                Completed participants can be launched into the runtime report through an audited, tenant-scoped handoff.
                {access.canExportReports
                  ? " Export remains a separate audited action."
                  : " Export actions remain hidden until you are in an admin-level workspace context."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {completedParticipants.data.length === 0 ? (
                <EmptyState
                  title="No participant reports yet"
                  description="Completed participant reports will appear here once assessments finish inside the current scope."
                />
              ) : (
                <div className="space-y-3">
                  {completedParticipants.data.map((participant) => {
                    const label =
                      participant.firstName || participant.lastName
                        ? `${participant.firstName ?? ""} ${participant.lastName ?? ""}`.trim()
                        : participant.email;

                    return (
                      <div
                        key={participant.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border/70 px-4 py-3"
                      >
                        <div className="min-w-0">
                          <Link
                            href={applyRoutePrefix(
                              routePrefix,
                              `/campaigns/${participant.campaignId}/participants/${participant.id}`
                            )}
                            className="inline-flex items-center gap-1 font-medium transition-colors hover:text-primary"
                          >
                            {label}
                            <ExternalLink className="size-3.5 opacity-60" />
                          </Link>
                          <p className="truncate text-xs text-muted-foreground">
                            {participant.campaignTitle} • Completed {formatDate(participant.completedAt)}
                          </p>
                        </div>
                        <Link
                          href={getParticipantReportHref(routePrefix, participant.id)}
                          className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                        >
                          Open report
                          <ExternalLink className="size-3.5 opacity-70" />
                        </Link>
                        {access.canExportReports ? (
                          <Link
                            href={getParticipantExportHref(routePrefix, participant.id)}
                            className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                          >
                            Export
                            <ExternalLink className="size-3.5 opacity-70" />
                          </Link>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {showDiagnosticsSection ? (
        <Card>
          <CardHeader>
            <CardTitle>Completed diagnostics</CardTitle>
            <CardDescription>Completed diagnostic sessions currently visible to this portal.</CardDescription>
          </CardHeader>
          <CardContent>
            {completedDiagnostics.length === 0 ? (
              <EmptyState
                title="No diagnostic results yet"
                description="There are no completed diagnostic sessions in the current scope yet."
              />
            ) : (
              <div className="space-y-3">
                {completedDiagnostics.map((session) => (
                  <div key={session.id} className="flex items-center justify-between rounded-lg border border-border/70 px-4 py-3">
                    <div>
                      <Link
                        href={applyRoutePrefix(routePrefix, `/diagnostics/${session.id}`)}
                        className="inline-flex items-center gap-1 font-medium transition-colors hover:text-primary"
                      >
                        {session.title}
                        <ExternalLink className="size-3.5 opacity-60" />
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {session.clientName} • {session.templateName}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="default">completed</Badge>
                      <span className="text-xs text-muted-foreground">{session.respondentCount} respondents</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

async function WorkspaceMatchingPage({
  access,
  config,
  routePrefix,
}: {
  access: WorkspaceAccessResult;
  config: WorkspacePortalPageConfig;
  routePrefix: string;
}) {
  const runs = await getWorkspaceMatchingRuns();
  const completedRuns = runs.filter((run) => run.status === "completed").length;
  const activeRuns = runs.filter((run) => run.status === "running" || run.status === "pending").length;
  const recommendationCount = runs.reduce((sum, run) => sum + run.resultCount, 0);

  return (
    <div className="space-y-8">
      <PageHeader eyebrow={config.eyebrow} title={config.title} description={config.description}>
        <HeaderActions config={config} routePrefix={routePrefix} />
      </PageHeader>

      <WorkspaceAccessCard access={access} />

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Matching runs"
          value={runs.length}
          description="Visible inside the current workspace scope"
          icon={Sparkles}
        />
        <MetricCard
          label="Completed"
          value={completedRuns}
          description={`${activeRuns} still running or pending`}
          icon={CheckCircle2}
        />
        <MetricCard
          label="Published matches"
          value={recommendationCount}
          description="Recommendations returned by the approved engine"
          icon={ClipboardList}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Matching outputs</CardTitle>
          <CardDescription>
            Partners can consume published matching recommendations without accessing engine controls.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <EmptyState
              title="No matching outputs available"
              description="No matching runs are visible inside the current partner scope yet."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Diagnostic session</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Top matches</TableHead>
                  <TableHead>Results</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((run) => {
                  const status = matchingStatusConfig[run.status] ?? matchingStatusConfig.pending;

                  return (
                    <TableRow key={run.id}>
                      <TableCell>
                        <div>
                          <Link
                            href={applyRoutePrefix(routePrefix, `/diagnostics/${run.diagnosticSessionId}`)}
                            className="inline-flex items-center gap-1 font-medium transition-colors hover:text-primary"
                          >
                            {run.sessionTitle || "Matching run"}
                            <ExternalLink className="size-3.5 opacity-60" />
                          </Link>
                          <p className="text-xs text-muted-foreground">
                            Created {formatDate(run.created_at)}{run.completedAt ? ` • Completed ${formatDate(run.completedAt)}` : ""}
                          </p>
                          {run.errorMessage ? (
                            <p className="mt-1 text-xs text-destructive">{run.errorMessage}</p>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>{run.clientName || "Not set"}</TableCell>
                      <TableCell>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </TableCell>
                      <TableCell>
                        {run.recommendations.length === 0 ? (
                          <span className="text-sm text-muted-foreground">No published matches yet</span>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {run.recommendations.map((recommendation) => (
                              <Badge key={`${run.id}-${recommendation.rank}`} variant="outline">
                                {recommendation.factorName} {Math.round(recommendation.relevanceScore * 100)}%
                              </Badge>
                            ))}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>{run.resultCount}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export async function WorkspacePortalLivePage({
  access,
  config,
  routePrefix,
  surface,
  pageKey,
}: WorkspacePortalLivePageProps) {
  const segments = pageKey.split("/").filter(Boolean);
  const supportedKey = (segments[0] ?? "") as SupportedPageKey;

  if (supportedKey === "campaigns" && segments.length === 2) {
    return (
      <WorkspaceCampaignDetailPage
        access={access}
        config={config}
        routePrefix={routePrefix}
        campaignId={segments[1]}
      />
    );
  }

  if (
    supportedKey === "campaigns" &&
    segments.length === 4 &&
    segments[2] === "participants"
  ) {
    return (
      <WorkspaceParticipantDetailPage
        access={access}
        config={config}
        routePrefix={routePrefix}
        campaignId={segments[1]}
        participantId={segments[3]}
      />
    );
  }

  if (supportedKey === "diagnostics" && segments.length === 2) {
    return (
      <WorkspaceDiagnosticDetailPage
        access={access}
        config={config}
        routePrefix={routePrefix}
        sessionId={segments[1]}
        surface={surface}
      />
    );
  }

  switch (supportedKey) {
    case "":
      return (
        <WorkspaceOverview
          access={access}
          config={config}
          routePrefix={routePrefix}
          surface={surface}
        />
      );
    case "clients":
      if (surface === "partner") {
        return (
          <WorkspaceClientsPage
            access={access}
            config={config}
            routePrefix={routePrefix}
          />
        );
      }
      break;
    case "campaigns":
      return (
        <WorkspaceCampaignsPage
          access={access}
          config={config}
          routePrefix={routePrefix}
        />
      );
    case "assessments":
      return (
        <WorkspaceAssessmentsPage
          access={access}
          config={config}
          routePrefix={routePrefix}
        />
      );
    case "diagnostics":
      return (
        <WorkspaceDiagnosticsPage
          access={access}
          config={config}
          routePrefix={routePrefix}
        />
      );
    case "results":
      return (
        <WorkspaceResultsPage
          access={access}
          config={config}
          routePrefix={routePrefix}
          surface={surface}
        />
      );
    case "matching":
      if (surface === "partner") {
        return (
          <WorkspaceMatchingPage
            access={access}
            config={config}
            routePrefix={routePrefix}
          />
        );
      }
      break;
    default:
      break;
  }

  return (
    <WorkspacePortalPage
      access={access}
      config={config}
      routePrefix={routePrefix}
    />
  );
}
