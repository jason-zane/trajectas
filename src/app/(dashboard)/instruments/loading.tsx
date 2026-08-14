import { DataTableLoading } from '@/components/data-table'
import { PageHeader } from '@/components/page-header'

function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={`animate-shimmer rounded-md bg-gradient-to-r from-muted via-muted/60 to-muted bg-[length:200%_100%] ${className ?? ''}`}
    />
  )
}

export default function InstrumentsLoading() {
  return (
    <div className='space-y-8 max-w-6xl'>
      <PageHeader
        eyebrow='Library'
        title='Instruments'
        description='Design and manage assessment instruments.'
      >
        <Shimmer className='h-10 w-40 rounded-lg' />
      </PageHeader>

      <DataTableLoading columnCount={7} filterCount={1} />
    </div>
  )
}
