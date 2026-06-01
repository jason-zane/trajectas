import { NextResponse, after } from 'next/server'
import { z } from 'zod'
import { getComparisonMatrix } from '@/app/actions/comparison'
import { buildComparisonCsv } from '@/lib/comparison/build-csv'
import { resolveAuthorizedScope } from '@/lib/auth/authorization'
import { logAuditEvent } from '@/lib/auth/support-sessions'

export const maxDuration = 60

const Body = z.object({
  entries: z.array(
    z.object({
      campaignParticipantId: z.string().uuid(),
      sessionIdsByAssessment: z.record(z.string().uuid(), z.string().uuid()).optional(),
    }),
  ),
  assessmentIds: z.array(z.string().uuid()),
  visibleLevels: z.array(z.enum(['dimension', 'factor'])).optional(),
  campaignSlug: z.string().min(1).optional(),
})

function todayUtcYyyymmdd(): string {
  const d = new Date()
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

export async function POST(req: Request): Promise<Response> {
  const json = await req.json()
  const parsed = Body.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_body', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const result = await getComparisonMatrix({
    entries: parsed.data.entries,
    assessmentIds: parsed.data.assessmentIds,
    visibleLevels: parsed.data.visibleLevels,
  })
  const csv = buildComparisonCsv(result)
  const filename = parsed.data.campaignSlug
    ? `trajectas-comparison-${parsed.data.campaignSlug}-${todayUtcYyyymmdd()}.csv`
    : `trajectas-comparison-participants-${todayUtcYyyymmdd()}.csv`

  // Audit the PII export (participant comparison data). Best-effort via after()
  // so it never blocks or breaks the download. getComparisonMatrix already
  // authorised the caller, so resolveAuthorizedScope() (request-cached) resolves
  // the actor cheaply.
  after(async () => {
    try {
      const scope = await resolveAuthorizedScope()
      await logAuditEvent({
        actorProfileId: scope.actor?.id ?? null,
        eventType: 'comparison.exported',
        targetTable: 'campaign_participants',
        metadata: {
          participantCount: parsed.data.entries.length,
          assessmentIds: parsed.data.assessmentIds,
          campaignSlug: parsed.data.campaignSlug ?? null,
        },
      })
    } catch {
      // audit is best-effort
    }
  })

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
