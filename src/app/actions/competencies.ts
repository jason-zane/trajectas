'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { mapCompetencyRow } from '@/lib/supabase/mappers'
import { competencySchema } from '@/lib/validations/competencies'
import type { Competency } from '@/types/database'

export type CompetencyWithMeta = Competency & {
  dimensionName?: string
  traitCount: number
  itemCount: number
}

export type SelectOption = { id: string; name: string }

export async function getCompetencies(): Promise<CompetencyWithMeta[]> {
  const db = createAdminClient()
  const { data, error } = await db
    .from('competencies')
    .select('*, dimensions(name), competency_traits(count), items(count)')
    .order('name', { ascending: true })

  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = row as any
    return {
      ...mapCompetencyRow(row),
      dimensionName: r.dimensions?.name ?? undefined,
      traitCount: r.competency_traits?.[0]?.count ?? 0,
      itemCount: r.items?.[0]?.count ?? 0,
    }
  })
}

export async function getCompetencyBySlug(slug: string) {
  const db = createAdminClient()
  const { data, error } = await db
    .from('competencies')
    .select('*, dimensions(name), competency_traits(*, traits(id, name, slug))')
    .eq('slug', slug)
    .single()

  if (error) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = data as any
  return {
    ...mapCompetencyRow(data),
    dimensionName: r.dimensions?.name ?? undefined,
    linkedTraits: (r.competency_traits ?? []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ct: any) => ({
        id: ct.id,
        traitId: ct.trait_id,
        name: ct.traits?.name ?? '',
        weight: Number(ct.weight),
        displayOrder: ct.display_order,
      })
    ),
  }
}

export async function getDimensionsForSelect(): Promise<SelectOption[]> {
  const db = createAdminClient()
  const { data, error } = await db
    .from('dimensions')
    .select('id, name')
    .eq('is_active', true)
    .order('display_order', { ascending: true })

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getTraitsForSelect(): Promise<SelectOption[]> {
  const db = createAdminClient()
  const { data, error } = await db
    .from('traits')
    .select('id, name')
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function createCompetency(formData: FormData) {
  const traitsJson = formData.get('traits') as string
  let traits: { traitId: string; weight: number }[] = []
  try {
    traits = traitsJson ? JSON.parse(traitsJson) : []
  } catch {
    // ignore parse errors
  }

  const raw = {
    name: formData.get('name') as string,
    slug: formData.get('slug') as string,
    description: (formData.get('description') as string) || undefined,
    definition: (formData.get('definition') as string) || undefined,
    dimensionId: (formData.get('dimensionId') as string) || undefined,
    isActive: formData.get('isActive') !== 'false',
    traits,
    indicatorsLow: (formData.get('indicatorsLow') as string) || undefined,
    indicatorsMid: (formData.get('indicatorsMid') as string) || undefined,
    indicatorsHigh: (formData.get('indicatorsHigh') as string) || undefined,
  }

  const parsed = competencySchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const db = createAdminClient()

  // Insert competency
  const { data: comp, error: compErr } = await db
    .from('competencies')
    .insert({
      name: parsed.data.name,
      slug: parsed.data.slug,
      description: parsed.data.description ?? null,
      definition: parsed.data.definition ?? null,
      dimension_id: parsed.data.dimensionId || null,
      is_active: parsed.data.isActive,
      indicators_low: parsed.data.indicatorsLow ?? null,
      indicators_mid: parsed.data.indicatorsMid ?? null,
      indicators_high: parsed.data.indicatorsHigh ?? null,
    })
    .select('id')
    .single()

  if (compErr) return { error: { _form: [compErr.message] } }

  // Insert trait links
  if (parsed.data.traits.length > 0) {
    const links = parsed.data.traits.map((t, i) => ({
      competency_id: comp.id,
      trait_id: t.traitId,
      weight: t.weight,
      display_order: i + 1,
    }))
    await db.from('competency_traits').insert(links)
  }

  revalidatePath('/factors')
  revalidatePath('/')
  redirect('/factors')
}

export async function updateCompetency(id: string, formData: FormData) {
  const traitsJson = formData.get('traits') as string
  let traits: { traitId: string; weight: number }[] = []
  try {
    traits = traitsJson ? JSON.parse(traitsJson) : []
  } catch {
    // ignore parse errors
  }

  const raw = {
    name: formData.get('name') as string,
    slug: formData.get('slug') as string,
    description: (formData.get('description') as string) || undefined,
    definition: (formData.get('definition') as string) || undefined,
    dimensionId: (formData.get('dimensionId') as string) || undefined,
    isActive: formData.get('isActive') !== 'false',
    traits,
    indicatorsLow: (formData.get('indicatorsLow') as string) || undefined,
    indicatorsMid: (formData.get('indicatorsMid') as string) || undefined,
    indicatorsHigh: (formData.get('indicatorsHigh') as string) || undefined,
  }

  const parsed = competencySchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const db = createAdminClient()

  const { error: updateErr } = await db
    .from('competencies')
    .update({
      name: parsed.data.name,
      slug: parsed.data.slug,
      description: parsed.data.description ?? null,
      definition: parsed.data.definition ?? null,
      dimension_id: parsed.data.dimensionId || null,
      is_active: parsed.data.isActive,
      indicators_low: parsed.data.indicatorsLow ?? null,
      indicators_mid: parsed.data.indicatorsMid ?? null,
      indicators_high: parsed.data.indicatorsHigh ?? null,
    })
    .eq('id', id)

  if (updateErr) return { error: { _form: [updateErr.message] } }

  // Replace trait links: delete old, insert new
  await db.from('competency_traits').delete().eq('competency_id', id)

  if (parsed.data.traits.length > 0) {
    const links = parsed.data.traits.map((t, i) => ({
      competency_id: id,
      trait_id: t.traitId,
      weight: t.weight,
      display_order: i + 1,
    }))
    await db.from('competency_traits').insert(links)
  }

  revalidatePath('/factors')
  revalidatePath('/')
  redirect('/factors')
}

export async function deleteCompetency(id: string) {
  const db = createAdminClient()
  // Delete trait links first (cascade should handle it, but be explicit)
  await db.from('competency_traits').delete().eq('competency_id', id)
  const { error } = await db.from('competencies').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/factors')
  revalidatePath('/')
  redirect('/factors')
}
