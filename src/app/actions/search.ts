'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { assertAdminOnly, resolveAuthorizedScope } from '@/lib/auth/authorization'

export async function getAllEntities() {
  const scope = await resolveAuthorizedScope()
  assertAdminOnly(scope)
  const db = createAdminClient()

  const [dims, facts, consts, items] = await Promise.all([
    db.from('dimensions').select('id, name, slug').order('name'),
    db.from('factors').select('id, name, slug').order('name'),
    db.from('constructs').select('id, name, slug').order('name'),
    db.from('items').select('id, stem').order('display_order').limit(100),
  ])

  return {
    dimensions: (dims.data ?? []).map(d => ({ id: d.id, name: d.name, slug: d.slug })),
    factors: (facts.data ?? []).map(f => ({ id: f.id, name: f.name, slug: f.slug })),
    constructs: (consts.data ?? []).map(c => ({ id: c.id, name: c.name, slug: c.slug })),
    items: (items.data ?? []).map(i => ({ id: i.id, name: i.stem })),
  }
}
