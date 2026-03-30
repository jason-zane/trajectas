import Link from "next/link";
import { Lock, ShieldCheck, UserRound } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { WorkspaceAccessResult } from "@/lib/auth/workspace-access";
import type { WorkspacePortalPageConfig } from "@/lib/workspace-portal-config";
import { applyRoutePrefix } from "@/lib/surfaces";

interface WorkspacePortalPageProps {
  access: WorkspaceAccessResult;
  config: WorkspacePortalPageConfig;
  routePrefix: string;
}

function AccessStateCard({ access }: { access: WorkspaceAccessResult }) {
  if (access.status === "ok" && access.actor) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-4" />
            Access resolved
          </CardTitle>
          <CardDescription>
            This surface is running with an authenticated actor context.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground/70">Actor</p>
            <p className="mt-1 font-medium text-foreground">{access.actor.email}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground/70">Partner memberships</p>
            <p className="mt-1 font-medium text-foreground">{access.partnerMembershipCount}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground/70">Client memberships</p>
            <p className="mt-1 font-medium text-foreground">{access.clientMembershipCount}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (access.status === "forbidden") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="size-4" />
            Membership required
          </CardTitle>
          <CardDescription>
            Your current authenticated actor does not have membership for this workspace.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          The UI is available for build-out, but tenant-scoped data will remain inaccessible until the actor is granted the right membership context.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserRound className="size-4" />
          Authentication still required
        </CardTitle>
        <CardDescription>
          This workspace is isolated now, but it is not yet connected to a complete sign-in and membership selection flow.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        The surface is ready for real host routing and future access control, while still being previewable during implementation.
      </CardContent>
    </Card>
  );
}

export function WorkspacePortalPage({
  access,
  config,
  routePrefix,
}: WorkspacePortalPageProps) {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={config.eyebrow}
        title={config.title}
        description={config.description}
      >
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
      </PageHeader>

      <AccessStateCard access={access} />

      <div className="grid gap-4 lg:grid-cols-2">
        {config.sections.map((section) => (
          <Card key={section.title}>
            <CardHeader>
              <CardTitle>{section.title}</CardTitle>
              <CardDescription>{section.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm text-muted-foreground">
                {section.highlights.map((highlight) => (
                  <li key={highlight} className="rounded-lg bg-muted/40 px-3 py-2">
                    {highlight}
                  </li>
                ))}
              </ul>
              {section.nextSteps?.length ? (
                <div>
                  <p className="mb-2 text-xs uppercase tracking-[0.16em] text-muted-foreground/70">
                    Next
                  </p>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {section.nextSteps.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
