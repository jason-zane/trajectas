import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/page-header'
import { EmptyState } from '@/components/empty-state'
import { listInstrumentBuilds } from '@/app/actions/instrument'
import { InstrumentsDataTable } from './instruments-data-table'

export default async function InstrumentsPage() {
  const builds = await listInstrumentBuilds()

  return (
    <div className='space-y-8 max-w-6xl'>
      <PageHeader
        eyebrow='Library'
        title='Instruments'
        description='Design and manage assessment instruments for specific competencies and contexts.'
      >
        <Link href='/instruments/new'>
          <Button>
            <Plus className='size-4' />
            New Instrument
          </Button>
        </Link>
      </PageHeader>

      {builds.length === 0 ? (
        <EmptyState
          eyebrow='No instruments yet'
          title='Create your first instrument'
          description='Design a new assessment instrument by defining competencies, facets, and item intensity levels. Start with a measure type that matches your assessment context.'
          actionLabel='Create Instrument'
          actionHref='/instruments/new'
        />
      ) : (
        <InstrumentsDataTable builds={builds} />
      )}
    </div>
  )
}
