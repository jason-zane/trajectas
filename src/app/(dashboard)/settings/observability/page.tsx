import { Activity, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollReveal } from "@/components/scroll-reveal";
import { requireAdminScope } from "@/lib/auth/authorization";
import {
  getRecentErrors,
  getErrorSummary,
  getSystemHealth,
  type ErrorSeverity,
} from "@/lib/dal/observability";

export const dynamic = "force-dynamic";

const SEVERITY_CLASS: Record<ErrorSeverity, string> = {
  fatal: "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400",
  error: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  warning: "border-yellow-500/40 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
};

function SeverityBadge({ severity }: { severity: ErrorSeverity }) {
  return (
    <Badge variant="outline" className={SEVERITY_CLASS[severity]}>
      {severity}
    </Badge>
  );
}

function HealthRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm">{label}</span>
      {ok ? (
        <span className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="size-4" /> Healthy
        </span>
      ) : (
        <span className="flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400">
          <XCircle className="size-4" /> Not configured / down
        </span>
      )}
    </div>
  );
}

export default async function ObservabilityPage() {
  // Defence in depth — Platform Settings are admin-only, but error data can
  // contain sensitive context, so re-verify here.
  await requireAdminScope();

  const [health, summary, recent] = await Promise.all([
    getSystemHealth(),
    getErrorSummary(7),
    getRecentErrors({ limit: 100 }),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Settings"
        title="Observability"
        description="System health and recorded errors. Failures are persisted to error_events and (when OPS_ALERT_EMAIL is set) emailed to ops."
      />

      <ScrollReveal>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="size-4" /> System health
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border">
            <HealthRow label="Database" ok={health.database === "ok"} />
            <HealthRow label="Email (Resend)" ok={health.email === "ok"} />
          </CardContent>
        </Card>
      </ScrollReveal>

      <ScrollReveal>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4" /> Top errors (last 7 days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {summary.length > 0 ? (
              <ul className="divide-y divide-border">
                {summary.slice(0, 20).map((group) => (
                  <li key={group.fingerprint} className="flex items-start justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <SeverityBadge severity={group.severity} />
                        <span className="font-mono text-caption text-muted-foreground">{group.source}</span>
                      </div>
                      <p className="mt-1 truncate text-sm">{group.sampleMessage}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold">{group.count}×</p>
                      <time className="text-caption text-muted-foreground" dateTime={group.lastSeen}>
                        {new Date(group.lastSeen).toLocaleString()}
                      </time>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-2 text-sm text-muted-foreground">
                No errors recorded in the last 7 days. 🎉
              </p>
            )}
          </CardContent>
        </Card>
      </ScrollReveal>

      <ScrollReveal>
        <Card>
          <CardHeader>
            <CardTitle>Recent errors</CardTitle>
          </CardHeader>
          <CardContent>
            {recent.length > 0 ? (
              <ul className="divide-y divide-border">
                {recent.map((event) => (
                  <li key={event.id} className="flex items-start justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <SeverityBadge severity={event.severity} />
                        <span className="font-mono text-caption text-muted-foreground">{event.source}</span>
                        {event.alerted ? (
                          <span className="text-caption text-muted-foreground">· alerted</span>
                        ) : null}
                      </div>
                      <p className="mt-1 truncate text-sm">{event.message}</p>
                    </div>
                    <time
                      className="shrink-0 text-caption text-muted-foreground"
                      dateTime={event.occurredAt}
                    >
                      {new Date(event.occurredAt).toLocaleString()}
                    </time>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-2 text-sm text-muted-foreground">No errors recorded yet.</p>
            )}
          </CardContent>
        </Card>
      </ScrollReveal>
    </div>
  );
}
