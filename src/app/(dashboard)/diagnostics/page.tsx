import Link from "next/link";
import { Plus, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { getDiagnosticSessions } from "@/app/actions/diagnostics";
import { DiagnosticSessionsTable } from "./diagnostic-sessions-table";

export default async function DiagnosticsPage() {
  const sessions = await getDiagnosticSessions();

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

      <DiagnosticSessionsTable sessions={sessions} />
    </div>
  );
}
