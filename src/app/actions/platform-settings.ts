'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminScope } from '@/lib/auth/authorization'
import { isSchemeValid } from '@/lib/reports/band-scheme-validation'
import type { BandScheme } from '@/lib/reports/band-scheme'

export async function getPlatformBandScheme(): Promise<BandScheme | null> {
  const db = createAdminClient()
  const { data, error } = await db
    .from('platform_settings')
    .select('band_scheme')
    .limit(1)
    .maybeSingle()
  if (error || !data) return null
  return (data.band_scheme as BandScheme | null) ?? null
}

export async function updatePlatformBandScheme(scheme: BandScheme) {
  await requireAdminScope()
  if (!isSchemeValid(scheme)) return { error: 'Invalid band scheme' }

  const db = createAdminClient()
  const { data: rows } = await db.from('platform_settings').select('id').limit(1)
  const existingId = (rows && rows[0] && 'id' in rows[0]) ? (rows[0].id as string) : null

  if (existingId) {
    const { error } = await db
      .from('platform_settings')
      .update({ band_scheme: scheme, updated_at: new Date().toISOString() })
      .eq('id', existingId)
    if (error) return { error: error.message }
  } else {
    const { error } = await db.from('platform_settings').insert({ band_scheme: scheme })
    if (error) return { error: error.message }
  }

  revalidatePath('/settings/reports/band-scheme')
  return { success: true }
}
