import Link from "next/link";
import { Plus, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { ScrollReveal } from "@/components/scroll-reveal";
import { getGenerationRuns } from "@/app/actions/generation";
import { DeleteRunButton } from "./delete-run-button";
import type { GenerationRunStatus } from "@/types/database";

type StatusMeta = {
  label: string;
  variant: "default" | "secondary" | "outline" | "destructive";
};

const statusMeta: Record<GenerationRunStatus, StatusMeta> = {
  configuring: { label: "In Progress", variant: "default" },
  generating: { label: "In Progress", variant: "default" },
  embedding: { label: "In Progress", variant: "default" },
  analysing: { label: "In Progress", variant: "default" },
  reviewing: { label: "Review Needed", variant: "secondary" },
  completed: { label: "Completed", variant: "outline" },
  failed: { label: "Failed", variant: "destructive" },
};

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

function formatConstructTitle(names: string[]): string {
  if (names.length === 0) return "No constructs";
  if (names.length <= 3) return names.join(", ");
  return `${names.length} constructs`;
}

export default async function GeneratePage() {
  const runs = await getGenerationRuns();

  return (
    <div className="space-y-8 max-w-5xl">
      <PageHeader
        eyebrow="Library"
        title="Item Generator"
        description="Generate psychometric items for your constructs using AI. Review and accept items into your library."
      >
        <Link href="/generate/new">
          <Button>
            <Plus className="size-4" />
            New Generation
          </Button>
        </Link>
      </PageHeader>

      {runs.length === 0 ? (
        <EmptyState
          title="No generation runs yet"
          description="Start your first AI generation run to produce psychometric items for your constructs."
          actionLabel="New Generation"
          actionHref="/generate/new"
        />
      ) : (
        <ScrollReveal>
          <div className="rounded-xl border border-border bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Constructs</TableHead>
                  <TableHead className="w-36">Status</TableHead>
                  <TableHead className="w-20 text-right">Items</TableHead>
                  <TableHead className="w-20 text-right">NMI</TableHead>
                  <TableHead className="w-48">Model</TableHead>
                  <TableHead className="w-28">Date</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((run) => {
                  const meta = statusMeta[run.status] ?? { label: run.status, variant: "secondary" as const };
                  const title = formatConstructTitle(run.constructNames);

                  return (
                    <TableRow key={run.id} className="group">
                      <TableCell>
                        <Link
                          href={`/generate/${run.id}`}
                          className="font-medium text-sm hover:text-primary transition-colors line-clamp-1"
                        >
                          {title}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant={meta.variant}>{meta.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                        {run.itemsGenerated}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                        {run.nmiFinal !== undefined && run.nmiFinal !== null
                          ? run.nmiFinal.toFixed(2)
                          : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground truncate max-w-0">
                        <span className="block truncate">{run.modelUsed ?? "—"}</span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatRelativeTime(run.created_at)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <DeleteRunButton runId={run.id} />
                          </div>
                          <ChevronRight className="size-4 text-muted-foreground/40 group-hover:text-foreground transition-colors" />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </ScrollReveal>
      )}
    </div>
  );
}
