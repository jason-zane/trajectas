import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Campaign360SnapshotView } from "@/app/actions/three-sixty";

interface CategoryAgg {
  category: string;
  n: number;
  mean: number | null;
  suppressed: boolean;
}
interface FactorAgg {
  factorId: string;
  name: string;
  self: number | null;
  categories: CategoryAgg[];
  othersMean: number | null;
  gap: number | null;
  quadrant: string;
}

const QUADRANT: Record<
  string,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive"; hint: string }
> = {
  confirmed_strength: { label: "Confirmed strength", variant: "default", hint: "Seen as strong by self and others." },
  blind_spot: { label: "Blind spot", variant: "destructive", hint: "Rates self higher than others do." },
  hidden_strength: { label: "Hidden strength", variant: "secondary", hint: "Others rate higher than self." },
  shared_development: { label: "Development area", variant: "outline", hint: "Seen as a growth area by self and others." },
  aligned: { label: "Aligned", variant: "outline", hint: "Self and others broadly agree." },
  insufficient_data: { label: "Not enough data", variant: "outline", hint: "Awaiting more responses." },
};

// Surface the most coaching-relevant factors first.
const QUADRANT_ORDER: Record<string, number> = {
  blind_spot: 0,
  hidden_strength: 1,
  confirmed_strength: 2,
  shared_development: 3,
  aligned: 4,
  insufficient_data: 5,
};

const CATEGORY_LABELS: Record<string, string> = {
  manager: "Manager",
  peer: "Peers",
  direct_report: "Direct reports",
  other: "Others",
};

function fmt(v: number | null): string {
  return v === null ? "—" : String(Math.round(v));
}

function categoryCell(cats: CategoryAgg[], key: string) {
  const c = cats.find((x) => x.category === key);
  if (!c || c.n === 0) return <span className="text-muted-foreground">—</span>;
  if (c.suppressed)
    return (
      <span
        className="text-muted-foreground"
        title={`Hidden — fewer than 3 ${CATEGORY_LABELS[key]?.toLowerCase()} responded`}
      >
        — <span className="text-[10px]">({c.n})</span>
      </span>
    );
  return (
    <span className="tabular-nums">
      {fmt(c.mean)} <span className="text-[10px] text-muted-foreground">({c.n})</span>
    </span>
  );
}

export function Campaign360Report({
  campaignId,
  subjectName,
  snapshot,
}: {
  campaignId: string;
  subjectName: string;
  snapshot: Campaign360SnapshotView | null;
}) {
  if (!snapshot) {
    return (
      <div className="space-y-6 max-w-3xl">
        <PageHeader eyebrow="360 Feedback" title="Results" />
        <EmptyState
          variant="default"
          title="No results yet"
          description="Generate the 360 results from the Subject & Raters tab once raters have completed their feedback."
          actionLabel="Go to Subject & Raters"
          actionHref={`/campaigns/${campaignId}/raters`}
        />
      </div>
    );
  }

  const data = snapshot.data as unknown as {
    factors?: FactorAgg[];
    selfCompleted?: boolean;
  };
  const factors = [...(data.factors ?? [])].sort(
    (a, b) =>
      (QUADRANT_ORDER[a.quadrant] ?? 9) - (QUADRANT_ORDER[b.quadrant] ?? 9) ||
      Math.abs(b.gap ?? 0) - Math.abs(a.gap ?? 0),
  );

  const byCat = snapshot.raterCountByCategory ?? {};

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        eyebrow="360 Feedback"
        title="Results"
        description={subjectName}
      />

      <Alert variant="info">
        <AlertDescription>
          This 360 is <strong>for development, not evaluation</strong>. Scores
          are best explored in a coaching conversation. Peer and direct-report
          scores are shown only when at least 3 people responded, to protect
          rater anonymity.
        </AlertDescription>
      </Alert>

      {/* Coverage */}
      <Card>
        <CardHeader>
          <CardTitle>Rater coverage</CardTitle>
          <CardDescription>
            {snapshot.raterCount} observer
            {snapshot.raterCount === 1 ? "" : "s"} responded
            {data.selfCompleted ? ", plus the self-assessment." : "."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {Object.keys(CATEGORY_LABELS).map((k) => (
            <Badge key={k} variant="outline">
              {CATEGORY_LABELS[k]}: {byCat[k] ?? 0}
            </Badge>
          ))}
        </CardContent>
      </Card>

      {/* Gap-led table */}
      <Card>
        <CardHeader>
          <CardTitle>Self vs. others</CardTitle>
          <CardDescription>
            Sorted to surface blind spots and hidden strengths first. Scores are
            0–100; gap is self minus the observer average.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {factors.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No factor scores are available yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Factor</TableHead>
                  <TableHead className="text-right">Self</TableHead>
                  <TableHead className="text-right">Manager</TableHead>
                  <TableHead className="text-right">Peers</TableHead>
                  <TableHead className="text-right">Reports</TableHead>
                  <TableHead className="text-right">Other</TableHead>
                  <TableHead className="text-right">Observers</TableHead>
                  <TableHead className="text-right">Gap</TableHead>
                  <TableHead>Insight</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {factors.map((f) => {
                  const q = QUADRANT[f.quadrant] ?? QUADRANT.aligned;
                  return (
                    <TableRow key={f.factorId}>
                      <TableCell className="font-medium">{f.name}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmt(f.self)}
                      </TableCell>
                      <TableCell className="text-right">
                        {categoryCell(f.categories, "manager")}
                      </TableCell>
                      <TableCell className="text-right">
                        {categoryCell(f.categories, "peer")}
                      </TableCell>
                      <TableCell className="text-right">
                        {categoryCell(f.categories, "direct_report")}
                      </TableCell>
                      <TableCell className="text-right">
                        {categoryCell(f.categories, "other")}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmt(f.othersMean)}
                      </TableCell>
                      <TableCell
                        className={`text-right tabular-nums ${
                          f.gap === null
                            ? ""
                            : f.gap > 5
                              ? "text-amber-600"
                              : f.gap < -5
                                ? "text-emerald-600"
                                : "text-muted-foreground"
                        }`}
                      >
                        {f.gap === null
                          ? "—"
                          : `${f.gap > 0 ? "+" : ""}${Math.round(f.gap)}`}
                      </TableCell>
                      <TableCell>
                        <Badge variant={q.variant} title={q.hint}>
                          {q.label}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <p className="text-caption text-muted-foreground">
        Generated {new Date(snapshot.generatedAt).toLocaleString()}. A dash (—)
        means a category had no responses or fewer than 3 raters (hidden for
        anonymity).
      </p>
    </div>
  );
}
