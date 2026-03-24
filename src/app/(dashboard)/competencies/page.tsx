import Link from "next/link";
import { Plus, Brain } from "lucide-react";
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
const competencies: {
  id: string;
  name: string;
  category: string;
  itemsCount: number;
  status: string;
}[] = [];

export default function CompetenciesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Competency Library
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your psychometric competency definitions and associated items.
          </p>
        </div>
        <Button>
          <Plus className="size-4" />
          Create Competency
        </Button>
      </div>

      {competencies.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <Brain className="size-6 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-sm font-medium">No competencies yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Get started by creating your first competency definition.
          </p>
          <Button className="mt-4" size="sm">
            <Plus className="size-4" />
            Create Competency
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Items Count</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {competencies.map((competency) => (
                <TableRow key={competency.id}>
                  <TableCell className="font-medium">
                    {competency.name}
                  </TableCell>
                  <TableCell>{competency.category}</TableCell>
                  <TableCell className="text-right">
                    {competency.itemsCount}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground">
                      {competency.status}
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
