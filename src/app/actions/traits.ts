'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { mapTraitRow, toTraitInsert } from '@/lib/supabase/mappers'
import { traitSchema } from '@/lib/validations/traits'
import type { Trait } from '@/types/database'

export type TraitWithCounts = Trait & { competencyCount: number }

export type TraitWithRelationships = Trait & {
  linkedItems: { id: string; stem: string; status: string; responseFormatType?: string }[]
  parentFactors: { id: string; name: string; slug: string }[]
}

export async function getTraits(): Promise<TraitWithCounts[]> {
  const db = createAdminClient()
  const { data, error } = await db
    .from('traits')
    .select('*, competency_traits(count)')
    .order('name', { ascending: true })

  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => ({
    ...mapTraitRow(row),
    competencyCount: (row as Record<string, unknown>).competency_traits
      ? ((row as Record<string, unknown>).competency_traits as { count: number }[])[0]?.count ?? 0
      : 0,
  }))
}

export async function getTraitBySlug(slug: string): Promise<TraitWithRelationships | null> {
  const db = createAdminClient()
  const { data, error } = await db
    .from('traits')
    .select('*, items(id, stem, status, response_formats(type)), competency_traits(*, competencies(id, name, slug))')
    .eq('slug', slug)
    .single()

  if (error) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = data as any
  return {
    ...mapTraitRow(data),
    linkedItems: (r.items ?? []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (item: any) => ({
        id: item.id,
        stem: item.stem,
        status: item.status,
        responseFormatType: item.response_formats?.type ?? undefined,
      })
    ),
    parentFactors: (r.competency_traits ?? []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ct: any) => ({
        id: ct.competencies?.id ?? ct.competency_id,
        name: ct.competencies?.name ?? '',
        slug: ct.competencies?.slug ?? '',
      })
    ),
  }
}

export async function createTrait(formData: FormData) {
  const raw = {
    name: formData.get('name') as string,
    slug: formData.get('slug') as string,
    description: (formData.get('description') as string) || undefined,
    definition: (formData.get('definition') as string) || undefined,
    isActive: formData.get('isActive') !== 'false',
    indicatorsLow: (formData.get('indicatorsLow') as string) || undefined,
    indicatorsMid: (formData.get('indicatorsMid') as string) || undefined,
    indicatorsHigh: (formData.get('indicatorsHigh') as string) || undefined,
  }

  const parsed = traitSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const db = createAdminClient()
  const insert = toTraitInsert(parsed.data)
  const { error } = await db.from('traits').insert(insert)
  if (error) return { error: { _form: [error.message] } }

  revalidatePath('/constructs')
  revalidatePath('/')
  redirect('/constructs')
}

export async function updateTrait(id: string, formData: FormData) {
  const raw = {
    name: formData.get('name') as string,
    slug: formData.get('slug') as string,
    description: (formData.get('description') as string) || undefined,
    definition: (formData.get('definition') as string) || undefined,
    isActive: formData.get('isActive') !== 'false',
    indicatorsLow: (formData.get('indicatorsLow') as string) || undefined,
    indicatorsMid: (formData.get('indicatorsMid') as string) || undefined,
    indicatorsHigh: (formData.get('indicatorsHigh') as string) || undefined,
  }

  const parsed = traitSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const db = createAdminClient()
  const { error } = await db
    .from('traits')
    .update({
      name: parsed.data.name,
      slug: parsed.data.slug,
      description: parsed.data.description ?? null,
      definition: parsed.data.definition ?? null,
      is_active: parsed.data.isActive,
      indicators_low: parsed.data.indicatorsLow ?? null,
      indicators_mid: parsed.data.indicatorsMid ?? null,
      indicators_high: parsed.data.indicatorsHigh ?? null,
    })
    .eq('id', id)

  if (error) return { error: { _form: [error.message] } }

  revalidatePath('/constructs')
  revalidatePath('/')
  redirect('/constructs')
}

export async function deleteTrait(id: string) {
  const db = createAdminClient()
  const { error } = await db.from('traits').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/constructs')
  revalidatePath('/')
  redirect('/constructs')
}
