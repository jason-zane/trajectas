'use client'

import Link from 'next/link'
import { Plus, Wand2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/page-header'
import { EmptyState } from '@/components/empty-state'
import { QuickBuildModal } from '@/components/instruments/quick-build-modal'
import { InstrumentsDataTable } from './instruments-data-table'

interface InstrumentsPageClientProps {
  builds: Awaited<ReturnType<typeof import('@/app/actions/instrument').listInstrumentBuilds>>
}

export function InstrumentsPageClient({ builds }: InstrumentsPageClientProps) {
  const [quickBuildOpen, setQuickBuildOpen] = useState(false)

  return (
    <div className='space-y-8 max-w-6xl'>
      <PageHeader
        eyebrow='Library'
        title='Instruments'
        description='Design and manage assessment instruments for specific competencies and contexts.'
      >
        <div className='flex items-center gap-2'>
          <Button onClick={() => setQuickBuildOpen(true)} variant='default'>
            <Wand2 className='size-4' />
            Quick Build
          </Button>
          <Link href='/instruments/new'>
            <Button variant='outline'>
              <Plus className='size-4' />
              New Instrument
            </Button>
          </Link>
        </div>
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

      <QuickBuildModal open={quickBuildOpen} onOpenChange={setQuickBuildOpen} />
    </div>
  )
}
