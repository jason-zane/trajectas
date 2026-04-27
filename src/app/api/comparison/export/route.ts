import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getComparisonMatrix } from '@/app/actions/comparison'
import { buildComparisonCsv } from '@/lib/comparison/build-csv'

const Body = z.object({
  entries: z.array(
    z.object({
      campaignParticipantId: z.string().uuid(),
      sessionIdsByAssessment: z.record(z.string().uuid(), z.string().uuid()).optional(),
    }),
  ),
  assessmentIds: z.array(z.string().uuid()),
  visibleLevels: z.array(z.enum(['dimension', 'factor', 'construct'])).optional(),
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

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
