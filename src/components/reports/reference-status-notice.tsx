import type { ReportSnapshot } from '@/types/database'
import { getReferenceStatusesForAuthorizedSnapshots } from '@/lib/reports/reference-status'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

/** Mount only after the containing page has authorized this exact snapshot. */
export async function ReferenceStatusNotice({ snapshot }: { snapshot: ReportSnapshot }) {
  if (!snapshot.referenceVersionId) return null
  const statuses = await getReferenceStatusesForAuthorizedSnapshots([snapshot])
  if (statuses[snapshot.referenceVersionId] !== 'withdrawn') return null
  return <Alert variant="warning"><AlertTitle>Reference withdrawn from future use</AlertTitle><AlertDescription>This saved report retains the comparison originally used. The reference has since been withdrawn. Ask your campaign manager for a new report using an approved reference before relying on this comparison.</AlertDescription></Alert>
}
