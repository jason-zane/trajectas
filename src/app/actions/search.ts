'use server'

import { createAdminClient } from '@/lib/supabase/admin'

export async function getAllEntities() {
  const db = createAdminClient()

  const [dims, comps, traits, items] = await Promise.all([
    db.from('dimensions').select('id, name, slug').order('name'),
    db.from('competencies').select('id, name, slug').order('name'),
    db.from('traits').select('id, name, slug').order('name'),
    db.from('items').select('id, stem').order('display_order').limit(100),
  ])

  return {
    dimensions: (dims.data ?? []).map(d => ({ id: d.id, name: d.name, slug: d.slug })),
    factors: (comps.data ?? []).map(c => ({ id: c.id, name: c.name, slug: c.slug })),
    constructs: (traits.data ?? []).map(t => ({ id: t.id, name: t.name, slug: t.slug })),
    items: (items.data ?? []).map(i => ({ id: i.id, name: i.stem })),
  }
}
