import Link from 'next/link'
import { resolvePartnerOrg } from '@/lib/auth/resolve-partner-org'
import { listPartnerIntegrationClients } from '@/lib/dal/partner-integration-clients'
import { PartnerIntegrationClientsTable } from './clients-table'
import { PageHeader } from '@/components/page-header'
import { EmptyState } from '@/components/empty-state'
import { buttonVariants } from '@/components/ui/button-variants'

export default async function PartnerIntegrationsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { partnerId } = await resolvePartnerOrg('/partner/integrations')
  if (!partnerId) throw new Error('Partner workspace unavailable.')
  const requested = Number((await searchParams).page ?? 0)
  const page = Number.isInteger(requested) && requested >= 0 && requested <= 10000 ? requested : 0
  const { clients, hasMore } = await listPartnerIntegrationClients(partnerId, page)
  return <div className="space-y-6 max-w-6xl">
    <PageHeader eyebrow="Integrations" title="Client integrations" description="Manage connections and review saved webhook events for clients you already manage." />
    {clients.length ? <PartnerIntegrationClientsTable clients={clients} /> : <EmptyState title="No integration clients" description="No manageable clients are available in this partner workspace." />}
    <div className="flex gap-3">
      {page > 0 && <Link className={buttonVariants({ variant: 'outline' })} href={`/partner/integrations?page=${page - 1}`}>Previous clients</Link>}
      {hasMore && <Link className={buttonVariants({ variant: 'outline' })} href={`/partner/integrations?page=${page + 1}`}>More clients</Link>}
    </div>
  </div>
}
