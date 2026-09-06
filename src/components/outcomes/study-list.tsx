"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { createOutcomeStudyAction } from "@/app/actions/outcomes";
import type { OutcomeStudy } from "@/lib/outcomes/types";
import { OutcomeField, OutcomeSelect } from "./fields";
export function OutcomeStudyList({
  studies,
  clients,
}: {
  studies: OutcomeStudy[];
  clients: { id: string; name: string }[];
}) {
  const router = useRouter(),
    [creating, setCreating] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PageHeader
        eyebrow="Insights"
        title="Business Outcomes"
        description="Connect assessment evidence to the measures that matter to each business."
      >
        <Button onClick={() => setCreating(!creating)}>
          <Plus className="size-4" />
          New study
        </Button>
      </PageHeader>
      <div className="border-y py-6 md:flex md:items-center md:justify-between md:gap-12">
        <p className="max-w-2xl text-lg leading-relaxed">
          Find the capabilities associated with stronger business outcomes.
          Build a clear, credible case for what to explore next.
        </p>
        <p className="mt-4 shrink-0 text-xs uppercase tracking-widest text-muted-foreground md:mt-0">
          Assessment evidence
          <br />
          <span className="mt-2 block text-primary">Business meaning</span>
        </p>
      </div>
      {creating && (
        <form
          className="rounded-xl border bg-card p-6"
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            setError("");
            const form = new FormData(event.currentTarget);
            const result = await createOutcomeStudyAction({
              title: form.get("title"),
              question: form.get("question"),
              clientId: form.get("clientId"),
            });
            setBusy(false);
            if (result.error) {
              setError(result.error);
              toast.error(result.error);
            } else {
              toast.success("Study created");
              router.replace(`/business-outcomes/${result.data}`);
            }
          }}
        >
          <div className="grid gap-5 md:grid-cols-2">
            <OutcomeField label="Study name">
              <Input
                name="title"
                required
                maxLength={160}
                placeholder="Customer experience and service capability"
              />
            </OutcomeField>
            <OutcomeField label="Client">
              <OutcomeSelect name="clientId" required defaultValue="">
                <option value="" disabled>
                  Choose a client
                </option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </OutcomeSelect>
            </OutcomeField>
          </div>
          <div className="mt-5">
            <OutcomeField label="Business question">
              <Textarea
                name="question"
                maxLength={1500}
                placeholder="Which capabilities are associated with higher customer satisfaction?"
              />
            </OutcomeField>
          </div>
          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="mt-5 flex gap-3">
            <Button type="submit" disabled={busy}>
              {busy ? "Creating…" : "Create study"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setCreating(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
      <DataTable
        data={studies}
        searchableColumns={["title", "clientName"]}
        searchPlaceholder="Find a study or client…"
        rowHref={(s) => `/business-outcomes/${s.id}`}
        columns={[
          {
            accessorKey: "title",
            header: "Study",
            cell: ({ row }) => (
              <span className="font-semibold">{row.original.title}</span>
            ),
          },
          { accessorKey: "clientName", header: "Client" },
          {
            id: "metrics",
            header: "Business measures",
            cell: ({ row }) => (
              <span>
                {row.original.config.metrics.map((m) => m.label).join(", ") ||
                  "Awaiting setup"}
              </span>
            ),
          },
          {
            accessorKey: "createdAt",
            header: "Created",
            cell: ({ row }) =>
              new Date(row.original.createdAt).toLocaleDateString("en-AU"),
          },
          {
            id: "open",
            header: "",
            cell: () => (
              <ArrowUpRight className="size-4" aria-label="Open study" />
            ),
          },
        ]}
        emptyState={
          <EmptyState
            eyebrow="Your first business study"
            title="Start with a question worth answering"
            description="Choose a client, connect assessment results and business data, then build an executive report."
          />
        }
      />
    </div>
  );
}
