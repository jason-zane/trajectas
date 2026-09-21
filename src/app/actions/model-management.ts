'use server'
import { z } from 'zod'
import { revalidatePath, updateTag } from 'next/cache'
import { requireAdminScope } from '@/lib/auth/authorization'
import { requireModelManager, setCapabilityChannel } from '@/lib/dal/model-management'
import { logAuditEventSafe } from '@/lib/auth/support-sessions'
const changeSchema = z.object({ ids: z.array(z.string().uuid()).min(1).max(200).transform(ids => [...new Set(ids)]), channel: z.enum(['matching', 'assessment', 'public']), enabled: z.boolean() })
export async function updateCapabilityAvailability(input: unknown): Promise<{ error?: string }> {
  await requireAdminScope()
  const scope = await requireModelManager()
  const parsed = changeSchema.safeParse(input)
  if (!parsed.success) return { error: 'Choose capabilities and a valid availability setting.' }
  try {
    const { ids, channel, enabled } = parsed.data
    await setCapabilityChannel(ids, channel, enabled)
    await logAuditEventSafe({ actorProfileId: scope.actor?.id ?? null, eventType: 'capability.availability.updated', targetTable: 'factors', metadata: { ids, channel, enabled } })
    updateTag('taxonomy')
    for (const path of ['/model-management', '/capability-model', '/factors', '/assessments']) revalidatePath(path)
    return {}
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Could not save availability.' }
  }
}
