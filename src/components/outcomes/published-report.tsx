"use client";
import { useState } from "react";
import { Download, Link2 } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import type { OutcomeReport } from "@/lib/outcomes/types";
import { OutcomeExecutiveReport } from "./executive-report";
export function PublishedOutcomeReport({
  report,
  clientUrl,
}: {
  report: OutcomeReport;
  clientUrl: string;
}) {
  const [technical, setTechnical] = useState(false);
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-overline text-primary">Published report</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Published {new Date(report.createdAt).toLocaleString("en-AU")}.
            Client access requires sign-in.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(clientUrl);
                toast.success("Client report link copied");
              } catch {
                toast.error("Unable to copy the link.");
              }
            }}
          >
            <Link2 className="size-4" />
            Copy client link
          </Button>
          <a
            className={buttonVariants({ variant: "default" })}
            href={`/api/outcomes/reports/${report.id}/pdf`}
          >
            <Download className="size-4" />
            Download PDF
          </a>
        </div>
      </div>
      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          className="accent-primary"
          checked={technical}
          onChange={(e) => setTechnical(e.target.checked)}
        />
        Show supporting analysis
      </label>
      <OutcomeExecutiveReport payload={report.payload} technical={technical} />
    </div>
  );
}
