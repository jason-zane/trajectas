'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { resolveAuthorizedScope } from '@/lib/auth/authorization'

export async function getDashboardStats() {
  const scope = await resolveAuthorizedScope()
  const db = createAdminClient()
  if (scope.isPlatformAdmin) {
    const [dimensions, factors, constructs, items, assessments, organizations] =
      await Promise.all([
        db.from('dimensions').select('*', { count: 'exact', head: true }),
        db.from('factors').select('*', { count: 'exact', head: true }),
        db.from('constructs').select('*', { count: 'exact', head: true }),
        db.from('items').select('*', { count: 'exact', head: true }),
        db.from('assessments').select('*', { count: 'exact', head: true }),
        db.from('organizations').select('*', { count: 'exact', head: true }),
      ])

    return {
      dimensions: dimensions.count ?? 0,
      factors: factors.count ?? 0,
      constructs: constructs.count ?? 0,
      items: items.count ?? 0,
      assessments: assessments.count ?? 0,
      organizations: organizations.count ?? 0,
    }
  }

  const [assessments, organizations] = await Promise.all([
    scope.clientIds.length > 0
      ? db.from('assessments').select('*', { count: 'exact', head: true }).in('organization_id', scope.clientIds)
      : Promise.resolve({ count: 0 }),
    scope.clientIds.length > 0
      ? db.from('organizations').select('*', { count: 'exact', head: true }).in('id', scope.clientIds)
      : Promise.resolve({ count: 0 }),
  ])

  return {
    dimensions: 0,
    factors: 0,
    constructs: 0,
    items: 0,
    assessments: assessments.count ?? 0,
    organizations: organizations.count ?? 0,
  }
}
