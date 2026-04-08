import { PageHeader } from '@/components/page-header'
import { getAllReadySnapshots } from '@/app/actions/reports'
import { ReportsTable } from './reports-table'

export default async function ReportsPage() {
  const snapshots = await getAllReadySnapshots()

  return (
    <div className="flex flex-col gap-8 p-6">
      <PageHeader
        eyebrow="Reports"
        title="Reports"
        description="Generated report snapshots. Click a report to preview or release."
      />

      <ReportsTable snapshots={snapshots} />
    </div>
  )
}
