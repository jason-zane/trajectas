import { Plus, ClipboardList } from "lucide-react";
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
const assessments: {
  id: string;
  name: string;
  competencies: number;
  scoringMethod: string;
  status: string;
}[] = [];

export default function AssessmentsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Assessments
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Build and manage psychometric assessments from your competency
            library.
          </p>
        </div>
        <Button>
          <Plus className="size-4" />
          Build Assessment
        </Button>
      </div>

      {assessments.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <ClipboardList className="size-6 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-sm font-medium">No assessments yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Create your first assessment by selecting competencies and
            configuring scoring.
          </p>
          <Button className="mt-4" size="sm">
            <Plus className="size-4" />
            Build Assessment
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="text-right">Competencies</TableHead>
                <TableHead>Scoring Method</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assessments.map((assessment) => (
                <TableRow key={assessment.id}>
                  <TableCell className="font-medium">
                    {assessment.name}
                  </TableCell>
                  <TableCell className="text-right">
                    {assessment.competencies}
                  </TableCell>
                  <TableCell>{assessment.scoringMethod}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground">
                      {assessment.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm">
                      Edit
                    </Button>
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
