import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireReportTemplateAccess } from '@/lib/auth/authorization'
import { logAuditEvent } from '@/lib/auth/support-sessions'
import { parsePersonalityPresentation } from '@/lib/reports/custom/personality-standard/presentation-config'
import { PERSONALITY_REPORT_SLUG } from '@/lib/reports/custom/personality-standard/data'

export async function savePersonalityReportPresentation(id: string, name: string, input: unknown, expectedUpdatedAt: string) {
  const access = await requireReportTemplateAccess(id, { forWrite: true })
  const presentation = parsePersonalityPresentation(input)
  const db = createAdminClient()
  const { data, error } = await db.from('report_templates').update({
    name, presentation_config: presentation, updated_at: new Date().toISOString(),
  }).eq('id', id).eq('custom_report_slug', PERSONALITY_REPORT_SLUG).eq('updated_at', expectedUpdatedAt).select('updated_at').single()
  if (error || !data) throw new Error('The report template changed or is unavailable. Refresh before saving again.')
  await logAuditEvent({ actorProfileId: access.scope.actor?.id, eventType: 'report.presentation.updated', targetTable: 'report_templates', targetId: id })
  return { updatedAt: data.updated_at as string }
}
