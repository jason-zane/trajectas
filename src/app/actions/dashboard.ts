'use server'

import { createClient } from '@/lib/supabase/server'
import { resolveAuthorizedScope } from '@/lib/auth/authorization'
import { throwActionError } from '@/lib/security/action-errors'

export async function getDashboardStats() {
  const scope = await resolveAuthorizedScope()
  const db = await createClient()
  if (scope.isPlatformAdmin) {
    const [dimensions, factors, constructs, items, assessments, clients] =
      await Promise.all([
        db.from('dimensions').select('*', { count: 'exact', head: true }).is('deleted_at', null),
        db.from('factors').select('*', { count: 'exact', head: true }).is('deleted_at', null),
        db.from('constructs').select('*', { count: 'exact', head: true }).is('deleted_at', null),
        db.from('items').select('*', { count: 'exact', head: true }).is('deleted_at', null),
        db.from('assessments').select('*', { count: 'exact', head: true }).is('deleted_at', null),
        db.from('clients').select('*', { count: 'exact', head: true }).is('deleted_at', null),
      ])

    const queries = [dimensions, factors, constructs, items, assessments, clients]
    const failedQuery = queries.find((query) => query.error)

    if (failedQuery?.error) {
      throwActionError(
        'getDashboardStats.platform',
        'Unable to load dashboard statistics.',
        failedQuery.error
      )
    }

    return {
      dimensions: dimensions.count ?? 0,
      factors: factors.count ?? 0,
      constructs: constructs.count ?? 0,
      items: items.count ?? 0,
      assessments: assessments.count ?? 0,
      clients: clients.count ?? 0,
    }
  }

  const [assessments, clients] = await Promise.all([
    scope.clientIds.length > 0
      ? db
          .from('assessments')
          .select('*', { count: 'exact', head: true })
          .is('deleted_at', null)
          .in('client_id', scope.clientIds)
      : Promise.resolve({ count: 0 }),
    scope.clientIds.length > 0
      ? db
          .from('clients')
          .select('*', { count: 'exact', head: true })
          .is('deleted_at', null)
          .in('id', scope.clientIds)
      : Promise.resolve({ count: 0 }),
  ])

  if ('error' in assessments && assessments.error) {
    throwActionError(
      'getDashboardStats.assessments',
      'Unable to load dashboard statistics.',
      assessments.error
    )
  }

  if ('error' in clients && clients.error) {
    throwActionError(
      'getDashboardStats.clients',
      'Unable to load dashboard statistics.',
      clients.error
    )
  }

  return {
    dimensions: 0,
    factors: 0,
    constructs: 0,
    items: 0,
    assessments: assessments.count ?? 0,
    clients: clients.count ?? 0,
  }
}
