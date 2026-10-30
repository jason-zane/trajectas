'use server'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { requireWorkspaceFeature } from '@/lib/features/access'
import { savePersonalityReportPresentation } from '@/lib/dal/personality-presentation'
import { postgresUuid } from '@/lib/validations/uuid'
export async function updatePersonalityReportPresentation(input: unknown) {
  await requireWorkspaceFeature('reportTemplateAuthoring')
  const request = z.object({ id: postgresUuid(), name: z.string().trim().min(1).max(160), presentation: z.unknown(), expectedUpdatedAt: z.string().datetime({ offset: true }) }).strict().parse(input)
  const result = await savePersonalityReportPresentation(request.id, request.name, request.presentation, request.expectedUpdatedAt)
  for (const prefix of ['/report-templates', '/partner/report-templates']) {
    revalidatePath(prefix); revalidatePath(`${prefix}/${request.id}/builder`); revalidatePath(`${prefix}/${request.id}/preview`)
  }
  return result
}
