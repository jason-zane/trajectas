'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAdminScope } from '@/lib/auth/authorization'
import { throwActionError } from '@/lib/security/action-errors'
import { mapLibraryCategoryRow } from '@/lib/supabase/mappers'
import type { LibraryCategory } from '@/types/database'

/** The high-level competency categories, ordered for display. */
export async function getLibraryCategories(): Promise<LibraryCategory[]> {
  await requireAdminScope()
  const db = await createClient()
  const { data, error } = await db
    .from('library_categories')
    .select('*')
    .order('display_order', { ascending: true })

  if (error) {
    throwActionError('getLibraryCategories', 'Unable to load categories.', error)
  }
  return (data ?? []).map((row) => mapLibraryCategoryRow(row as Record<string, unknown>))
}
