import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPublicBuildAdminDetail } from "@/app/actions/public-builds-admin";
import { formatDateTime } from "@/lib/formatting";

const TIER_LABEL: Record<string, string> = {
  essentials: "Essentials",
  core: "Core",
  full: "Full picture",
};

export default async function PublicBuildDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const build = await getPublicBuildAdminDetail(id);
  if (!build) notFound();

  const rankingByFactorId = new Map(
    (build.ranking?.picks ?? []).map((p) => [p.factorId, p]),
  );
  const finalPicks = (build.picks ?? []).map(
    (factorId) => rankingByFactorId.get(factorId) ?? { factorId, factorName: factorId, relevanceScore: 0, reasoning: "" },
  );

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <Link href="/public-builds" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3.5" />
          All builds
        </Link>
      </div>

      <PageHeader
        title={build.roleTitle || "Role Builder run"}
        description={build.email}
      >
        <Badge variant={build.status === "failed" ? "destructive" : "outline"}>
          {build.status}
        </Badge>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Timeline</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-5 text-sm">
          <TimelineField label="Ranked" value={formatDateTime(build.createdAt, "\u2014")} />
          <TimelineField label="Created" value={formatDateTime(build.createdAssessmentAt, "\u2014")} />
          <TimelineField label="Started" value={formatDateTime(build.startedAt, "\u2014")} />
          <TimelineField label="Completed" value={formatDateTime(build.completedAt, "\u2014")} />
          <TimelineField label="Report sent" value={formatDateTime(build.reportSentAt, "\u2014")} />
        </CardContent>
      </Card>

      {build.error && (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-base text-destructive">Error</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">{build.error}</CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Brief</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {build.brief ? (
            <>
              <p><span className="text-muted-foreground">Role:</span> {build.brief.roleTitle} ({build.brief.level}, {build.brief.function || "—"})</p>
              <p><span className="text-muted-foreground">Outcome intent:</span> {build.brief.outcomeIntent}</p>
              <p><span className="text-muted-foreground">Tier requested:</span> {build.tier ? TIER_LABEL[build.tier] ?? build.tier : "—"}</p>
              {build.brief.responsibilities.length > 0 && (
                <div>
                  <p className="text-muted-foreground">Responsibilities:</p>
                  <ul className="list-disc list-inside">
                    {build.brief.responsibilities.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <p className="text-muted-foreground">No brief extracted yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ranking</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {build.ranking ? (
            <>
              <p className="text-muted-foreground">{build.ranking.summary}</p>
              <ul className="space-y-1.5">
                {build.ranking.picks.slice(0, 15).map((p) => (
                  <li key={p.factorId} className="flex items-center justify-between gap-2 border-b pb-1 last:border-0">
                    <span>
                      #{p.rank} {p.factorName}
                    </span>
                    <span className="tabular-nums text-muted-foreground">{Math.round(p.relevanceScore)}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-muted-foreground">Not ranked yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Final picks</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          {finalPicks.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {finalPicks.map((p) => (
                <li key={p.factorId}>
                  <Badge variant="secondary">{p.factorName}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">No assessment created yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Created records</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {build.assessmentId ? (
            <Link href={`/assessments/${build.assessmentId}`}>
              <Button variant="outline" size="sm">
                Assessment <ExternalLink className="size-3.5" />
              </Button>
            </Link>
          ) : null}
          {build.campaignId ? (
            <Link href={`/campaigns/${build.campaignId}`}>
              <Button variant="outline" size="sm">
                Campaign <ExternalLink className="size-3.5" />
              </Button>
            </Link>
          ) : null}
          {!build.assessmentId && !build.campaignId && (
            <p className="text-sm text-muted-foreground">Nothing created yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TimelineField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
