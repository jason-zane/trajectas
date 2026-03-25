import Link from "next/link";
import {
  Plus,
  ClipboardList,
  Building2,
  FileText,
  Users,
  ArrowRight,
  Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { getDiagnosticSessions } from "@/app/actions/diagnostics";

const statusConfig: Record<
  string,
  { label: string; variant: "secondary" | "default" | "outline"; dotClass: string }
> = {
  draft: {
    label: "Draft",
    variant: "secondary",
    dotClass: "bg-muted-foreground/40",
  },
  active: {
    label: "Active",
    variant: "default",
    dotClass: "bg-primary",
  },
  completed: {
    label: "Completed",
    variant: "outline",
    dotClass: "bg-emerald-500",
  },
  archived: {
    label: "Archived",
    variant: "outline",
    dotClass: "bg-muted-foreground/40",
  },
};

export default async function DiagnosticsPage() {
  const sessions = await getDiagnosticSessions();

  return (
    <div className="space-y-8 max-w-6xl">
      <PageHeader
        title="Organisational Diagnostics"
        description="Run and manage diagnostic sessions across client organisations."
      >
        <div className="flex items-center gap-2">
          <Link href="/diagnostics/templates">
            <Button variant="outline">
              <Settings2 className="size-4" />
              Templates
            </Button>
          </Link>
          <Link href="/diagnostics/create">
            <Button>
              <Plus className="size-4" />
              New Session
            </Button>
          </Link>
        </div>
      </PageHeader>

      {sessions.length === 0 ? (
        <EmptyState
          title="No diagnostic sessions yet"
          description="Start a new diagnostic session for one of your client organisations. Configure templates first to define which dimensions are measured."
          actionLabel="New Session"
          actionHref="/diagnostics/create"
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {sessions.map((session, index) => {
            const status = statusConfig[session.status] ?? statusConfig.draft;
            return (
              <Link
                key={session.id}
                href={`/diagnostics/${session.id}`}
              >
                <Card
                  variant="interactive"
                  className={`stagger-${index + 1} animate-fade-in-up`}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted transition-colors">
                          <ClipboardList className="size-5 text-muted-foreground" />
                        </div>
                        <div>
                          <CardTitle>{session.title}</CardTitle>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="dot">
                              <span
                                className={`size-1.5 rounded-full ${status.dotClass}`}
                              />
                              {status.label}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <ArrowRight className="size-4 text-muted-foreground opacity-0 group-hover/card:opacity-100 transition-opacity mt-1" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="size-3.5" />
                          <span>{session.organizationName}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <FileText className="size-3.5" />
                          <span>{session.templateName}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t border-border/50">
                        <div className="flex items-center gap-1.5">
                          <Users className="size-3.5" />
                          <span>
                            {session.respondentCount}{" "}
                            {session.respondentCount === 1
                              ? "respondent"
                              : "respondents"}
                          </span>
                        </div>
                        <span>
                          Created{" "}
                          {new Date(session.created_at).toLocaleDateString(
                            "en-AU",
                            {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            }
                          )}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
