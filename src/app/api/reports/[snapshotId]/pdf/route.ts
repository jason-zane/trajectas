import { after } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  AuthenticationRequiredError,
  AuthorizationError,
  assertIndividualResultsAccess,
  requireReportSnapshotAccess,
} from '@/lib/auth/authorization'
import {
  generateAndStoreReportPdf,
  getSnapshotPdfState,
  mapReportPdfStatus,
  queueReportPdfGeneration,
} from '@/lib/reports/pdf'
import {
  contentDispositionAttachment,
  getReportPdfFilename,
} from '@/lib/reports/pdf-filename'
import { verifyReportAccessToken } from '@/lib/reports/report-access-token'
import { logAuditEvent } from '@/lib/auth/support-sessions'
import {
  parseOptionalJsonRequestWithLimit,
  RequestBodyTooLargeError,
} from '@/lib/security/request-body'

export const runtime = 'nodejs'
export const maxDuration = 300

const REPORTS_BUCKET = 'reports'
const MAX_PDF_POST_BODY_BYTES = 8 * 1024

type PdfAccess = Awaited<ReturnType<typeof requireReportSnapshotAccess>>

async function requirePdfAccess(
  snapshotId: string,
): Promise<{ error: Response } | { access: PdfAccess }> {
  try {
    const access = await requireReportSnapshotAccess(snapshotId)
    // Aggregate-only campaigns: no individual PDFs for client/partner
    // viewers. Participant token paths are unaffected (own report only).
    assertIndividualResultsAccess(access.scope, access.confidentialityMode)
    return { access }
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return { error: Response.json({ error: 'Authentication required' }, { status: 401 }) }
    }
    if (error instanceof AuthorizationError) {
      return { error: Response.json({ error: error.message }, { status: 403 }) }
    }
    throw error
  }
}

async function respondWithStoredPdf(storagePath: string, filename: string) {
  const db = createAdminClient()
  const { data, error } = await db.storage.from(REPORTS_BUCKET).download(storagePath)

  if (error || !data) {
    throw error ?? new Error('Stored PDF could not be downloaded')
  }

  return new Response(await data.arrayBuffer(), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': contentDispositionAttachment(filename),
      'Cache-Control': 'no-store',
    },
  })
}

async function validateReportTokenAccess(
  snapshotId: string,
  reportToken: string | null,
) {
  // A signed report token is an explicit grant for this one snapshot, including
  // a legacy report staff deliberately shared with its participant.
  const tokenPayload = verifyReportAccessToken(reportToken, snapshotId)
  if (!tokenPayload) {
    return Response.json({ error: 'Invalid report token' }, { status: 403 })
  }

  const db = createAdminClient()
  const { data: validSnapshot } = await db
    .from('report_snapshots')
    .select('id, participant_sessions!inner(campaign_participant_id)')
    .eq('id', snapshotId)
    .eq('status', 'released')
    .maybeSingle()

  const session = Array.isArray(validSnapshot?.participant_sessions)
    ? validSnapshot.participant_sessions[0]
    : (validSnapshot?.participant_sessions as
        | { campaign_participant_id: string | null }
        | null
        | undefined)

  if (
    !validSnapshot ||
    !session?.campaign_participant_id ||
    String(session.campaign_participant_id) !== tokenPayload.participantId
  ) {
    return Response.json({ error: 'Report not available' }, { status: 403 })
  }

  return null
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ snapshotId: string }> },
) {
  const { snapshotId } = await params
  const url = new URL(request.url)
  const forceRefresh = url.searchParams.get('refresh') === '1'
  const participantToken = url.searchParams.get('token')
  const reportToken = url.searchParams.get('reportToken')
  const db = createAdminClient()

  // Populated for the privileged (admin/consultant) path; the actual audit
  // event is written only once we know a real download is being served.
  let auditContext:
    | {
        actorProfileId: string | null
        clientId: string | null
        partnerId: string | null
        supportSessionId: string | null
        participantId: string | null
      }
    | null = null

  // Two auth paths: admin scope OR participant access token
  if (participantToken) {
    // Validate participant has access to this specific snapshot
    const { data: tokenData, error: tokenError } = await db
      .from('campaign_participants')
      .select('id, campaign_id')
      .eq('access_token', participantToken)
      .is('deleted_at', null)
      .maybeSingle()
    if (tokenError || !tokenData) {
      return Response.json({ error: 'Invalid participant token' }, { status: 403 })
    }
    // Verify this snapshot belongs to the participant's session and is released
    const { data: validSnapshot, error: snapshotError } = await db
      .from('report_snapshots')
      .select('id, audience_type, participant_sessions!inner(campaign_participant_id)')
      .eq('id', snapshotId)
      .eq('status', 'released')
      .maybeSingle()
    if (snapshotError || !validSnapshot ||
      (validSnapshot.audience_type != null && validSnapshot.audience_type !== 'participant')) {
      return Response.json({ error: 'Report not available' }, { status: 403 })
    }
    const session = Array.isArray(validSnapshot.participant_sessions)
      ? validSnapshot.participant_sessions[0]
      : (validSnapshot.participant_sessions as
          | { campaign_participant_id: string | null }
          | null
          | undefined)
    if (
      !session ||
      String(session.campaign_participant_id) !== String(tokenData.id)
    ) {
      return Response.json({ error: 'Report not available' }, { status: 403 })
    }
  } else if (reportToken) {
    const tokenError = await validateReportTokenAccess(snapshotId, reportToken)
    if (tokenError) {
      return tokenError
    }
  } else {
    const result = await requirePdfAccess(snapshotId)
    if ('error' in result) {
      return result.error
    }
    const { access } = result
    auditContext = {
      actorProfileId: access.scope.actor?.id ?? null,
      clientId: access.clientId,
      partnerId: access.partnerId,
      supportSessionId: access.scope.supportSession?.id ?? null,
      participantId: access.participantId,
    }
  }

  const snapshot = await getSnapshotPdfState(snapshotId)
  if (!snapshot) {
    return Response.json({ error: 'Report not found' }, { status: 404 })
  }
  const storagePath = snapshot.pdf_url ?? `reports/${snapshotId}.pdf`

  if (!['ready', 'released'].includes(String(snapshot.status))) {
    return Response.json(
      { error: 'PDF is only available for ready or released reports' },
      { status: 409 }
    )
  }

  // Audit privileged access only now that a real download will be served (the
  // report exists and is ready/released). Via after() so it never blocks the
  // download; links to the active support session if the admin is impersonating.
  if (auditContext) {
    const ctx = auditContext
    after(() =>
      logAuditEvent({
        actorProfileId: ctx.actorProfileId,
        eventType: 'report.pdf_downloaded',
        targetTable: 'report_snapshots',
        targetId: snapshotId,
        clientId: ctx.clientId,
        partnerId: ctx.partnerId,
        supportSessionId: ctx.supportSessionId,
        metadata: { participantId: ctx.participantId },
      }).catch(() => {}),
    )
  }

  const filename = await getReportPdfFilename(snapshotId)

  let shouldForceRefresh = forceRefresh
  if (snapshot.pdf_url && !forceRefresh) {
    try {
      return await respondWithStoredPdf(storagePath, filename)
    } catch {
      // Fall through to regeneration if the stored file has gone missing.
      shouldForceRefresh = true
    }
  }

  const pdfState = mapReportPdfStatus(snapshot, snapshotId)
  if (pdfState.status === 'queued' || pdfState.status === 'generating') {
    return Response.json(
      {
        error: 'PDF generation is already in progress',
        status: pdfState.status,
      },
      { status: 409 },
    )
  }

  try {
    const generated = await generateAndStoreReportPdf(snapshotId, {
      forceRefresh: shouldForceRefresh,
    })

    if (!generated) {
      return await respondWithStoredPdf(storagePath, filename)
    }
    if ('queued' in generated) {
      return Response.json({ status: 'queued', error: 'PDF is queued for generation' },
        { status: 409, headers: { 'Retry-After': '5' } })
    }

    return new Response(generated.body, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': contentDispositionAttachment(filename),
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'PDF generation failed'
    return Response.json({ error: message }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ snapshotId: string }> },
) {
  const { snapshotId } = await params
  const url = new URL(request.url)
  const reportToken = url.searchParams.get('reportToken')

  if (reportToken) {
    const tokenError = await validateReportTokenAccess(snapshotId, reportToken)
    if (tokenError) {
      return tokenError
    }
  } else {
    const result = await requirePdfAccess(snapshotId)
    if ('error' in result) {
      return result.error
    }
  }

  try {
    const body = await parseOptionalJsonRequestWithLimit<{
      forceRefresh?: boolean
    }>(request, MAX_PDF_POST_BODY_BYTES, {})

    const queued = await queueReportPdfGeneration(snapshotId, { forceRefresh: body.forceRefresh })
    if (queued.queued) {
      after(async () => {
        try {
          await generateAndStoreReportPdf(snapshotId, {
            forceRefresh: body.forceRefresh,
          })
        } catch (error) {
          console.error(`[reports] PDF generation failed for ${snapshotId}:`, error)
        }
      })
    }

    return Response.json({
      jobId: queued.jobId,
      status: queued.status,
      pdfUrl: queued.pdfUrl,
      error: queued.error,
    })
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return Response.json({ error: 'Request body too large' }, { status: 413 })
    }

    if (error instanceof SyntaxError) {
      return Response.json({ error: 'Request body must be valid JSON' }, { status: 400 })
    }

    const message =
      error instanceof Error ? error.message : 'Failed to queue PDF generation'
    return Response.json({ error: message }, { status: 500 })
  }
}
