import { Suspense } from "react";
import Link from "next/link";
import { Plus, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { getDiagnosticSessions } from "@/app/actions/diagnostics";
import { DiagnosticSessionsTable } from "./diagnostic-sessions-table";
import { DataTableSkeleton } from "@/components/loading/data-table-skeleton";

// Async component for the diagnostics table
async function DiagnosticsTableSection() {
  const sessions = await getDiagnosticSessions();

  return <DiagnosticSessionsTable sessions={sessions} />;
}

export default async function DiagnosticsPage() {
  return (
    <div className="space-y-8 max-w-6xl">
      <PageHeader
        title="Client Diagnostics"
        description="Run and manage diagnostic sessions across clients."
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

      <Suspense fallback={<DataTableSkeleton rows={8} columns={4} />}>
        <DiagnosticsTableSection />
      </Suspense>
    </div>
  );
}
