'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
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
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  const db = createAdminClient()
  const { error } = await db
    .from('profiles')
    .update({ display_name: parsed.data.displayName || null })
    .eq('id', user.id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/profile')
  return { success: true }
}
