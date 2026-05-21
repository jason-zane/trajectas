import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

export default async function AdminMigrationsPage() {
  const db = createAdminClient()

  // supabase_migrations.schema_migrations is the canonical applied-migration
  // log. version is the timestamp prefix (e.g. "20260521170000"), name is
  // the descriptive suffix.
  const { data: migrations, error } = await db
    .schema("supabase_migrations")
    .from("schema_migrations")
    .select("version, name, statements, created_by")
    .order("version", { ascending: false })
    .limit(100)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Migrations"
        description="Schema history as recorded by Supabase. Sorted newest first. Last 100 shown."
      />
      {error ? (
        <Card>
          <CardContent className="py-6 text-sm text-destructive">
            Failed to load migrations: {error.message}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">Version</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="w-[120px] text-right">Statements</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {migrations?.length ? (
                  migrations.map((m) => (
                    <TableRow key={m.version}>
                      <TableCell className="font-mono text-xs">{m.version}</TableCell>
                      <TableCell>{m.name ?? "—"}</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {Array.isArray(m.statements) ? m.statements.length : "—"}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                      No migrations recorded.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
