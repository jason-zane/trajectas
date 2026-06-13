import { NextResponse, after } from 'next/server'
import { getComparisonCanvas } from '@/app/actions/canvas'
import { buildCanvasCsv } from '@/lib/canvas/build-csv'
import { resolveAuthorizedScope } from '@/lib/auth/authorization'
import { logAuditEvent } from '@/lib/auth/support-sessions'
import { canvasRequestSchema } from '@/lib/validations/canvas'

export const maxDuration = 60

const Body = canvasRequestSchema

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

  // getComparisonCanvas authorises every participant id internally.
  const result = await getComparisonCanvas(parsed.data.campaignParticipantIds)
  const csv = buildCanvasCsv(result)
  const filename = `trajectas-trajectory-${todayUtcYyyymmdd()}.csv`

  // Audit the PII export. Best-effort via after() so it never blocks or
  // breaks the download; the canvas action already authorised the caller.
  after(async () => {
    try {
      const scope = await resolveAuthorizedScope()
      await logAuditEvent({
        actorProfileId: scope.actor?.id ?? null,
        eventType: 'trajectory.exported',
        targetTable: 'campaign_participants',
        metadata: {
          participantCount: parsed.data.campaignParticipantIds.length,
          personCount: result.people.length,
        },
      })
    } catch {
      // Audit logging must never break the export path.
    }
  })

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
