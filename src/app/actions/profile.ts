'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getVerifiedUserId } from '@/lib/auth/claims'
import { updateDisplayNameSchema } from '@/lib/validations/profile'

export interface UpdateProfileResult {
  success?: boolean
  error?: string
}

export async function updateDisplayName(
  displayName: string
): Promise<UpdateProfileResult> {
  const parsed = updateDisplayNameSchema.safeParse({ displayName })
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors
    return { error: fieldErrors.displayName?.[0] ?? 'Invalid input' }
  }

  const supabase = await createServerSupabaseClient()
  const userId = await getVerifiedUserId(supabase)

  if (!userId) {
    return { error: 'Not authenticated' }
  }

  const db = createAdminClient()
  const { error } = await db
    .from('profiles')
    .update({ display_name: parsed.data.displayName || null })
    .eq('id', userId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/profile')
  return { success: true }
}
