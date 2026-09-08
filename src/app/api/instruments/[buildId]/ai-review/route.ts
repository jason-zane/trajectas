import { requireAdminScope } from '@/lib/auth/authorization'
import { createAdminClient } from '@/lib/supabase/admin'
import { getLikertAuditReport } from '@/lib/instrument/likert/pipeline'
import { listStageRuns } from '@/lib/dal/instrument'
import { LIKERT_STAGE, LIKERT_STEP } from '@/lib/instrument/likert/contracts'
import { z } from 'zod'

export async function GET(_request: Request, { params }: { params: Promise<{ buildId: string }> }) {
  await requireAdminScope()
  const buildId = z.string().uuid().parse((await params).buildId)
  const db = createAdminClient()
  const [report, runs] = await Promise.all([getLikertAuditReport(db, buildId), listStageRuns(db, buildId)])
  return new Response(JSON.stringify({ report, history: runs.filter(run => [LIKERT_STAGE, LIKERT_STEP].includes(run.stageKey)) }, null, 2), {
    headers: { 'Content-Type': 'application/json', 'Content-Disposition': `attachment; filename="likert-review-${buildId}.json"`, 'Cache-Control': 'private, no-store' },
  })
}
