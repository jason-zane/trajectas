'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { requireAdminScope } from '@/lib/auth/authorization'
import { createAdminClient } from '@/lib/supabase/admin'
import { listLikertFormats } from '@/lib/dal/instrument-likert'
import { startLikert, advanceLikert, getLikertStatus } from '@/lib/instrument/likert/pipeline'

export async function getLikertResponseFormats() {
  await requireAdminScope()
  return listLikertFormats(createAdminClient())
}
export async function startLikertBuildAction(buildId: string, options: Record<string, unknown>) {
  await requireAdminScope()
  return startLikert(createAdminClient(), z.string().uuid().parse(buildId), options)
}
export async function advanceLikertBuildAction(buildId: string, resume = false) {
  await requireAdminScope()
  const status = await advanceLikert(createAdminClient(), z.string().uuid().parse(buildId), z.boolean().parse(resume))
  if (status.ready || status.phase === 'incomplete') revalidatePath(`/instruments/${buildId}`)
  return status
}
export async function getLikertBuildStatusAction(buildId: string) {
  await requireAdminScope()
  return getLikertStatus(createAdminClient(), z.string().uuid().parse(buildId))
}
