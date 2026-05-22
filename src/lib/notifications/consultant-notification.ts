/**
 * Post-release consultant notification.
 *
 * When a report snapshot reaches `status='released'`, this module emails the
 * campaign's configured consultant recipients with — depending on per-campaign
 * toggles — a score summary in the body and/or the rendered PDF attached.
 *
 * Called from:
 *   - src/lib/reports/runner.ts auto-release paths (custom + block reports)
 *   - src/app/actions/reports.ts:markSnapshotReleased (manual send-email flow)
 *
 * Idempotent via the `report_snapshots.consultant_notified_at` column —
 * subsequent calls for the same snapshot are no-ops once notified.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { sendHtmlEmail } from '@/lib/email/provider'
import { downloadSnapshotPdfBase64 } from '@/app/actions/reports'
import { getEffectiveBrand } from '@/app/actions/brand'
import { buildSurfaceUrl, getConfiguredSurfaceUrl } from '@/lib/hosts'

type CampaignSettings = {
  consultant_emails: string[]
  consultant_notification_enabled: boolean
  consultant_notification_include_summary: boolean
  consultant_notification_attach_pdf: boolean
  client_id: string | null
  title: string | null
}

type SessionSummary = {
  assessmentTitle: string
  participantName: string
  participantEmail: string
  compositeScore: number | null
  dimensions: Array<{ name: string; score: number }>
}

function pickEmbedded<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

const BRAND_PRIMARY = '#2d6a5a'

export async function notifyConsultantsForSnapshot(snapshotId: string): Promise<void> {
  const db = createAdminClient()
  const { data: snapshot, error } = await db
    .from('report_snapshots')
    .select(
      'id, status, campaign_id, participant_session_id, consultant_notified_at, report_templates(name)',
    )
    .eq('id', snapshotId)
    .maybeSingle()

  if (error || !snapshot) return
  if (snapshot.status !== 'released') return
  if (snapshot.consultant_notified_at) return
  if (!snapshot.campaign_id) return

  const campaign = await loadCampaignSettings(db, String(snapshot.campaign_id))
  if (!campaign) return
  if (!campaign.consultant_notification_enabled) return
  const recipients = (campaign.consultant_emails ?? [])
    .map((e) => String(e).trim())
    .filter(Boolean)
  if (recipients.length === 0) return

  const summary = await loadSessionSummary(db, String(snapshot.participant_session_id))

  const templateNameRaw = snapshot.report_templates
  const templateName = Array.isArray(templateNameRaw)
    ? String(templateNameRaw[0]?.name ?? 'Report')
    : (templateNameRaw as { name?: string } | null)?.name
      ? String((templateNameRaw as { name: string }).name)
      : 'Report'

  const brand = await getEffectiveBrand(campaign.client_id, String(snapshot.campaign_id))
  const reportUrl =
    buildSurfaceUrl('admin', `/reports/${snapshotId}`)?.toString() ??
    `${getConfiguredSurfaceUrl('admin') ?? ''}/reports/${snapshotId}`

  const includeSummary = campaign.consultant_notification_include_summary
  const attachPdf = campaign.consultant_notification_attach_pdf

  const subject = `${summary.participantName} completed ${summary.assessmentTitle}`
  const html = buildEmailHtml({
    brandName: brand.name,
    templateName,
    summary,
    campaignTitle: campaign.title ?? '',
    reportUrl,
    includeSummary,
    attachPdf,
  })
  const text = buildEmailText({
    brandName: brand.name,
    templateName,
    summary,
    campaignTitle: campaign.title ?? '',
    reportUrl,
    includeSummary,
    attachPdf,
  })

  const attachments = attachPdf
    ? await (async () => {
        const pdf = await downloadSnapshotPdfBase64(snapshotId)
        return pdf ? [{ filename: pdf.filename, content: pdf.content, contentType: 'application/pdf' }] : undefined
      })()
    : undefined

  const rawFrom = process.env.EMAIL_FROM ?? 'noreply@mail.trajectas.com'
  const emailMatch = rawFrom.match(/<([^>]+)>/)
  const emailAddress = emailMatch ? emailMatch[1] : rawFrom

  try {
    await sendHtmlEmail({
      to: recipients,
      subject,
      html,
      text,
      from: `${brand.name} <${emailAddress}>`,
      attachments,
    })
  } catch (sendError) {
    console.error(
      `[notifications] Consultant notification failed for snapshot ${snapshotId}:`,
      sendError,
    )
    return
  }

  await db
    .from('report_snapshots')
    .update({ consultant_notified_at: new Date().toISOString() })
    .eq('id', snapshotId)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadCampaignSettings(db: any, campaignId: string): Promise<CampaignSettings | null> {
  const { data, error } = await db
    .from('campaigns')
    .select(
      'consultant_emails, consultant_notification_enabled, consultant_notification_include_summary, consultant_notification_attach_pdf, client_id, title',
    )
    .eq('id', campaignId)
    .maybeSingle()
  if (error || !data) return null
  return data as CampaignSettings
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadSessionSummary(db: any, sessionId: string): Promise<SessionSummary> {
  const { data: session } = await db
    .from('participant_sessions')
    .select(
      'assessment_id, composite_score, campaign_participant_id, assessments(title), campaign_participants(first_name, last_name, email)',
    )
    .eq('id', sessionId)
    .maybeSingle()

  const assessment = Array.isArray(session?.assessments)
    ? session?.assessments[0]
    : session?.assessments
  const cp = Array.isArray(session?.campaign_participants)
    ? session?.campaign_participants[0]
    : session?.campaign_participants

  const firstName = cp?.first_name ?? ''
  const lastName = cp?.last_name ?? ''
  const participantName = `${firstName} ${lastName}`.trim() || (cp?.email ?? 'Participant')
  const participantEmail = cp?.email ?? ''
  const compositeScore =
    session?.composite_score != null ? Number(session.composite_score) : null

  const assessmentId = session?.assessment_id ? String(session.assessment_id) : null

  // Per-dimension aggregate scores. Use the same logic as the session view:
  // join scores → entity → dimension and take the mean per dimension.
  const dimensions: Array<{ name: string; score: number }> = []
  if (assessmentId) {
    const [{ data: scoreRows }, { data: acRows }] = await Promise.all([
      db
        .from('participant_scores')
        .select(
          'factor_id, construct_id, scoring_level, scaled_score, factors(dimension_id, dimensions(name)), constructs(name)',
        )
        .eq('session_id', sessionId),
      db
        .from('assessment_constructs')
        .select('construct_id, dimension_id, dimensions(name)')
        .eq('assessment_id', assessmentId),
    ])

    const constructToDim = new Map<string, { id: string; name: string }>()
    for (const row of (acRows ?? []) as Array<{
      construct_id: string
      dimension_id: string
      dimensions: { name: string } | { name: string }[] | null
    }>) {
      const dim = Array.isArray(row.dimensions) ? row.dimensions[0] : row.dimensions
      if (row.construct_id && row.dimension_id && dim?.name) {
        constructToDim.set(String(row.construct_id), {
          id: String(row.dimension_id),
          name: String(dim.name),
        })
      }
    }

    type FactorEmbed = {
      dimension_id?: string | null
      dimensions?: { name?: string | null } | { name?: string | null }[] | null
    }
    type ScoreRow = {
      factor_id?: string | null
      construct_id?: string | null
      scoring_level?: string | null
      scaled_score: number | string
      factors?: FactorEmbed | FactorEmbed[] | null
    }
    const buckets = new Map<string, { name: string; sum: number; count: number }>()
    for (const s of (scoreRows ?? []) as ScoreRow[]) {
      const score = Number(s.scaled_score)
      let dimId: string | undefined
      let dimName: string | undefined
      if (s.scoring_level === 'construct' && s.construct_id) {
        const lookup = constructToDim.get(String(s.construct_id))
        dimId = lookup?.id
        dimName = lookup?.name
      } else {
        const factor = pickEmbedded(s.factors)
        if (factor?.dimension_id) dimId = String(factor.dimension_id)
        const dim = pickEmbedded(factor?.dimensions)
        if (dim?.name) dimName = String(dim.name)
      }
      if (!dimId || !dimName) continue
      const existing = buckets.get(dimId)
      if (existing) {
        existing.sum += score
        existing.count += 1
      } else {
        buckets.set(dimId, { name: dimName, sum: score, count: 1 })
      }
    }
    for (const bucket of buckets.values()) {
      dimensions.push({
        name: bucket.name,
        score: bucket.count > 0 ? bucket.sum / bucket.count : 0,
      })
    }
    dimensions.sort((a, b) => b.score - a.score)
  }

  return {
    assessmentTitle: assessment?.title ? String(assessment.title) : 'Assessment',
    participantName,
    participantEmail,
    compositeScore,
    dimensions,
  }
}

interface EmailBodyParams {
  brandName: string
  templateName: string
  summary: SessionSummary
  campaignTitle: string
  reportUrl: string
  includeSummary: boolean
  attachPdf: boolean
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function buildEmailHtml(p: EmailBodyParams): string {
  const summaryHtml = p.includeSummary
    ? `
      <h3 style="margin:24px 0 8px;font-size:14px;font-weight:600;color:#1a1a1a;">Score summary</h3>
      <table style="border-collapse:collapse;width:100%;font-size:13px;">
        ${
          p.summary.compositeScore != null
            ? `<tr style="border-bottom:1px solid #e8e6e1;">
                 <td style="padding:6px 0;font-weight:600;">Overall</td>
                 <td style="padding:6px 0;text-align:right;font-weight:600;">${Math.round(p.summary.compositeScore)}</td>
               </tr>`
            : ''
        }
        ${p.summary.dimensions
          .map(
            (d) => `
              <tr style="border-bottom:1px solid #e8e6e1;">
                <td style="padding:6px 0;">${escapeHtml(d.name)}</td>
                <td style="padding:6px 0;text-align:right;">${Math.round(d.score)}</td>
              </tr>
            `,
          )
          .join('')}
      </table>
    `
    : ''

  const attachmentNote = p.attachPdf
    ? `<p style="margin:16px 0;font-size:13px;color:#555;">A PDF copy of the report is attached to this email.</p>`
    : ''

  const button = `
    <p style="margin:24px 0;">
      <a href="${escapeHtml(p.reportUrl)}"
         style="display:inline-block;padding:12px 28px;background:${BRAND_PRIMARY};color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:6px;">
        Open full report
      </a>
    </p>
  `

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#1a1a1a;max-width:600px;">
      <p style="margin:0 0 8px;">A new report is ready for your review.</p>
      <p style="margin:0 0 16px;font-size:14px;color:#555;">
        <strong>${escapeHtml(p.summary.participantName)}</strong>
        completed <strong>${escapeHtml(p.summary.assessmentTitle)}</strong>
        ${p.campaignTitle ? `as part of <strong>${escapeHtml(p.campaignTitle)}</strong>` : ''}.
      </p>
      ${summaryHtml}
      ${attachmentNote}
      ${button}
      <p style="margin:24px 0 0;font-size:12px;color:#999;">
        ${escapeHtml(p.brandName)} · ${escapeHtml(p.templateName)}
      </p>
    </div>
  `
}

function buildEmailText(p: EmailBodyParams): string {
  const summary = p.includeSummary
    ? [
        '',
        'Score summary:',
        ...(p.summary.compositeScore != null
          ? [`  Overall: ${Math.round(p.summary.compositeScore)}`]
          : []),
        ...p.summary.dimensions.map((d) => `  ${d.name}: ${Math.round(d.score)}`),
      ].join('\n')
    : ''
  const attachment = p.attachPdf ? '\nA PDF copy of the report is attached.' : ''
  return [
    `A new report is ready for your review.`,
    `${p.summary.participantName} completed ${p.summary.assessmentTitle}${
      p.campaignTitle ? ` as part of ${p.campaignTitle}` : ''
    }.`,
    summary,
    attachment,
    `Open the full report: ${p.reportUrl}`,
    '',
    `${p.brandName} · ${p.templateName}`,
  ]
    .filter(Boolean)
    .join('\n')
}
