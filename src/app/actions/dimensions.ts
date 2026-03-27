'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { mapDimensionRow, toDimensionInsert } from '@/lib/supabase/mappers'
import { dimensionSchema } from '@/lib/validations/dimensions'
import type { Dimension } from '@/types/database'

export type DimensionWithCounts = Dimension & { factorCount: number }

export type DimensionWithChildren = Dimension & {
  childFactors: { id: string; name: string; slug: string; isActive: boolean }[]
}

export async function getDimensions(): Promise<DimensionWithCounts[]> {
  const db = createAdminClient()
  const { data, error } = await db
    .from('dimensions')
    .select('*, factors(count)')
    .order('display_order', { ascending: true })

  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => ({
    ...mapDimensionRow(row),
    factorCount: (row as Record<string, unknown>).factors
      ? ((row as Record<string, unknown>).factors as { count: number }[])[0]?.count ?? 0
      : 0,
  }))
}

export async function getDimensionBySlug(slug: string): Promise<DimensionWithChildren | null> {
  const db = createAdminClient()
  const { data, error } = await db
    .from('dimensions')
    .select('*, factors(id, name, slug, is_active)')
    .eq('slug', slug)
    .single()

  if (error) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = data as any
  return {
    ...mapDimensionRow(data),
    childFactors: (r.factors ?? []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (c: any) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        isActive: c.is_active,
      })
    ),
  }
}

export async function createDimension(formData: FormData) {
  const raw = {
    name: formData.get('name') as string,
    slug: formData.get('slug') as string,
    description: (formData.get('description') as string) || undefined,
    definition: (formData.get('definition') as string) || undefined,
    displayOrder: Number(formData.get('displayOrder') ?? 0),
    isActive: formData.get('isActive') !== 'false',
    indicatorsLow: (formData.get('indicatorsLow') as string) || undefined,
    indicatorsMid: (formData.get('indicatorsMid') as string) || undefined,
    indicatorsHigh: (formData.get('indicatorsHigh') as string) || undefined,
  }

  const parsed = dimensionSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const db = createAdminClient()
  const insert = toDimensionInsert({
    ...parsed.data,
    isScored: true, // all dimensions scored by default
  })

  const { error } = await db.from('dimensions').insert(insert)
  if (error) return { error: { _form: [error.message] } }

  revalidatePath('/dimensions')
  revalidatePath('/')
  redirect('/dimensions')
}

export async function updateDimension(id: string, formData: FormData) {
  const raw = {
    name: formData.get('name') as string,
    slug: formData.get('slug') as string,
    description: (formData.get('description') as string) || undefined,
    definition: (formData.get('definition') as string) || undefined,
    displayOrder: Number(formData.get('displayOrder') ?? 0),
    isActive: formData.get('isActive') !== 'false',
    indicatorsLow: (formData.get('indicatorsLow') as string) || undefined,
    indicatorsMid: (formData.get('indicatorsMid') as string) || undefined,
    indicatorsHigh: (formData.get('indicatorsHigh') as string) || undefined,
  }

  const parsed = dimensionSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const db = createAdminClient()
  const { error } = await db
    .from('dimensions')
    .update({
      name: parsed.data.name,
      slug: parsed.data.slug,
      description: parsed.data.description ?? null,
      definition: parsed.data.definition ?? null,
      display_order: parsed.data.displayOrder,
      is_active: parsed.data.isActive,
      indicators_low: parsed.data.indicatorsLow ?? null,
      indicators_mid: parsed.data.indicatorsMid ?? null,
      indicators_high: parsed.data.indicatorsHigh ?? null,
    })
    .eq('id', id)

  if (error) return { error: { _form: [error.message] } }

  revalidatePath('/dimensions')
  revalidatePath('/')
  redirect('/dimensions')
}

export async function deleteDimension(id: string) {
  const db = createAdminClient()
  const { error } = await db.from('dimensions').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/dimensions')
  revalidatePath('/')
  redirect('/dimensions')
}
