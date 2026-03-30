import Link from "next/link";
import {
  Building2,
  ClipboardList,
  Layers,
  Loader2,
  ShieldCheck,
  Sparkles,
  Users,
  XCircle,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { getWorkspaceAssessmentSummaries } from "@/app/actions/assessments";
import { getCampaigns } from "@/app/actions/campaigns";
import { getDiagnosticSessions, getOrganizationsForDiagnosticSelect } from "@/app/actions/diagnostics";
import { getWorkspaceMatchingRuns } from "@/app/actions/matching";
import { getOrganizations } from "@/app/actions/organizations";
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
  | "organizations"
  | "assessments"
  | "campaigns"
  | "diagnostics"
  | "results"
  | "diagnostic-results"
  | "matching";

interface WorkspacePortalLivePageProps {
  access: WorkspaceAccessResult;
  config: WorkspacePortalPageConfig;
  routePrefix: string;
  surface: Extract<WorkspaceSurface, "partner" | "client">;
  pageKey: string;
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
  const contextLabel = access.activeContext?.tenantType
    ? `${access.activeContext.tenantType}:${access.activeContext.tenantId ?? "unknown"}`
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
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground/70">Active context</p>
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
    getOrganizations(),
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
                  <p className="font-medium">{campaign.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {campaign.organizationName || "Client not set"} • {campaign.participantCount} participants
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
  const clients = await getOrganizations();

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
                        <p className="font-medium">{campaign.title}</p>
                        <p className="text-xs text-muted-foreground">
                          Opens {formatDate(campaign.opensAt)} • Closes {formatDate(campaign.closesAt)}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>{campaign.organizationName || "Not set"}</TableCell>
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
    getOrganizationsForDiagnosticSelect(),
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
                        <p className="font-medium">{session.title}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(session.created_at)}</p>
                      </div>
                    </TableCell>
                    <TableCell>{session.organizationName}</TableCell>
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

async function WorkspaceResultsPage({
  access,
  config,
  routePrefix,
  diagnosticsOnly = false,
}: {
  access: WorkspaceAccessResult;
  config: WorkspacePortalPageConfig;
  routePrefix: string;
  diagnosticsOnly?: boolean;
}) {
  const [campaigns, diagnostics] = await Promise.all([
    diagnosticsOnly ? Promise.resolve([]) : getCampaigns(),
    getDiagnosticSessions(),
  ]);

  const campaignsWithResults = campaigns.filter((campaign) => campaign.completedCount > 0);
  const completedDiagnostics = diagnostics.filter((session) => session.status === "completed");

  return (
    <div className="space-y-8">
      <PageHeader eyebrow={config.eyebrow} title={config.title} description={config.description}>
        <HeaderActions config={config} routePrefix={routePrefix} />
      </PageHeader>

      <WorkspaceAccessCard access={access} />

      {!diagnosticsOnly ? (
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
                      <p className="font-medium">{campaign.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {campaign.organizationName || "Client not set"} • {campaign.completedCount} completed
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
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{diagnosticsOnly ? "Diagnostic results" : "Completed diagnostics"}</CardTitle>
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
                    <p className="font-medium">{session.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {session.organizationName} • {session.templateName}
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
                          <p className="font-medium">{run.sessionTitle || "Matching run"}</p>
                          <p className="text-xs text-muted-foreground">
                            Created {formatDate(run.created_at)}{run.completedAt ? ` • Completed ${formatDate(run.completedAt)}` : ""}
                          </p>
                          {run.errorMessage ? (
                            <p className="mt-1 text-xs text-destructive">{run.errorMessage}</p>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>{run.organizationName || "Not set"}</TableCell>
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
  const supportedKey = pageKey as SupportedPageKey;

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
    case "organizations":
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
        />
      );
    case "diagnostic-results":
      if (surface === "client") {
        return (
          <WorkspaceResultsPage
            access={access}
            config={config}
            routePrefix={routePrefix}
            diagnosticsOnly
          />
        );
      }
      break;
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
