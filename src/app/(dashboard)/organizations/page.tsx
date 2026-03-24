import { Plus, Building2 } from "lucide-react";
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
const organisations: {
  id: string;
  name: string;
  industry: string;
  partner: string;
  activeDiagnostics: number;
}[] = [];

export default function OrganisationsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Organisations
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage client organisations and their diagnostic engagements.
          </p>
        </div>
        <Button>
          <Plus className="size-4" />
          Add Organisation
        </Button>
      </div>

      {organisations.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <Building2 className="size-6 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-sm font-medium">No organisations yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Add your first client organisation to begin running diagnostics.
          </p>
          <Button className="mt-4" size="sm">
            <Plus className="size-4" />
            Add Organisation
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Industry</TableHead>
                <TableHead>Partner</TableHead>
                <TableHead className="text-right">
                  Active Diagnostics
                </TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {organisations.map((org) => (
                <TableRow key={org.id}>
                  <TableCell className="font-medium">{org.name}</TableCell>
                  <TableCell>{org.industry}</TableCell>
                  <TableCell>{org.partner}</TableCell>
                  <TableCell className="text-right">
                    {org.activeDiagnostics}
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
