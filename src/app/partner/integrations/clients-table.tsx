'use client'
import type { ColumnDef } from '@tanstack/react-table'
import type { PartnerIntegrationClient } from '@/lib/dal/partner-integration-clients'
import { DataTable, DataTableRowLink } from '@/components/data-table'

const columns: ColumnDef<PartnerIntegrationClient>[] = [
  { accessorKey: 'name', header: 'Client', cell: ({ row }) => <DataTableRowLink href={`/partner/integrations/${row.original.slug}`} ariaLabel={`Manage integrations for ${row.original.name}`}>{row.original.name}</DataTableRowLink> },
]
export function PartnerIntegrationClientsTable({ clients }: { clients: PartnerIntegrationClient[] }) {
  return <DataTable columns={columns} data={clients} getRowId={client => client.id} searchableColumns={['name']} revealOnScroll={false} />
}
