/**
 * Generate a figural-matrix bank and ingest it — the missing half of #347.
 *
 * `ingestBank` has existed since LR-8 but nothing called it, so the only way
 * to put items in the bank was a script run from a machine with the database
 * password. That is a poor place for the one operation that decides what an
 * assessment is made of: it leaves no audit trail a reviewer can see, and it
 * puts the construct id in a command-line flag where a wrong value looks
 * exactly like a right one.
 *
 * Server component. The generator itself runs inside the Server Action, not
 * here — see `generateAndIngestBank`.
 */

import Link from 'next/link'
import { ClipboardCheck, FlaskConical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/page-header'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { getGenerationTargets } from '@/app/actions/item-bank'
import { GenerateForm } from './generate-form'

/**
 * Generation is CPU-bound and the batch is written in one request. Ten families
 * at twenty candidates each is comfortably more work than the default limit
 * allows, and a timeout mid-write leaves a partially ingested run to reconcile.
 */
export const maxDuration = 300

export default async function GenerateBankPage() {
  const { constructs, responseFormats } = await getGenerationTargets()

  return (
    <div className="max-w-4xl space-y-8">
      <PageHeader
        eyebrow="Item bank"
        title="Generate items"
        description="Run the figural-matrix generator against a seed and ingest whatever clears the QA battery. Deterministic, and idempotent by content hash."
      >
        <div className="flex items-center gap-2">
          <Link href="/cognitive-items/runs">
            <Button variant="outline">
              <FlaskConical className="size-4" />
              Generation runs
            </Button>
          </Link>
          <Link href="/cognitive-items/review">
            <Button variant="outline">
              <ClipboardCheck className="size-4" />
              Review queue
            </Button>
          </Link>
        </div>
      </PageHeader>

      <Alert variant="info">
        <AlertTitle>Generating is not publishing</AlertTitle>
        <AlertDescription>
          Items arrive as drafts and stay there. The lifecycle guards refuse to advance an item until
          a person has recorded a content sign-off and a fairness sign-off against it, and those
          records are append-only — a mistaken approval is corrected by adding a rejection, never by
          editing history. Nothing generated here can reach a respondent until it has been through
          the review queue.
        </AlertDescription>
      </Alert>

      <GenerateForm constructs={constructs} responseFormats={responseFormats} />
    </div>
  )
}
