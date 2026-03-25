'use server'

import { createAdminClient } from '@/lib/supabase/admin'

export async function getDashboardStats() {
  const db = createAdminClient()
  const [dimensions, competencies, traits, items, assessments, organizations] =
    await Promise.all([
      db.from('dimensions').select('*', { count: 'exact', head: true }),
      db.from('competencies').select('*', { count: 'exact', head: true }),
      db.from('traits').select('*', { count: 'exact', head: true }),
      db.from('items').select('*', { count: 'exact', head: true }),
      db.from('assessments').select('*', { count: 'exact', head: true }),
      db.from('organizations').select('*', { count: 'exact', head: true }),
    ])
  return {
    dimensions: dimensions.count ?? 0,
    competencies: competencies.count ?? 0,
    traits: traits.count ?? 0,
    items: items.count ?? 0,
    assessments: assessments.count ?? 0,
    organizations: organizations.count ?? 0,
  }
}
