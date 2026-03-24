import { Plus, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Placeholder: will eventually fetch from Supabase
const sessions: {
  id: string;
  organisation: string;
  sessionName: string;
  status: string;
  respondents: number;
  lastUpdated: string;
}[] = [];

export default function DiagnosticsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Organisational Diagnostics
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Run and manage diagnostic sessions across client organisations.
          </p>
        </div>
        <Button>
          <Plus className="size-4" />
          New Session
        </Button>
      </div>

      {sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <Layers className="size-6 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-sm font-medium">
            No diagnostic sessions yet
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Start a new diagnostic session for one of your client organisations.
          </p>
          <Button className="mt-4" size="sm">
            <Plus className="size-4" />
            New Session
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organisation</TableHead>
                <TableHead>Session Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Respondents</TableHead>
                <TableHead>Last Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.map((session) => (
                <TableRow key={session.id}>
                  <TableCell className="font-medium">
                    {session.organisation}
                  </TableCell>
                  <TableCell>{session.sessionName}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground">
                      {session.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    {session.respondents}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {session.lastUpdated}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
