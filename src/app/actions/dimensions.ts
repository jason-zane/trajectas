'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { mapDimensionRow, toDimensionInsert } from '@/lib/supabase/mappers'
import { dimensionSchema } from '@/lib/validations/dimensions'
import type { Dimension } from '@/types/database'

export type DimensionWithCounts = Dimension & { factorCount: number }

export type DimensionWithChildren = Dimension & {
  childFactors: { id: string; name: string; slug: string; isActive: boolean }[]
}

/* ------------------------------------------------------------------ */
/*  Read functions                                                     */
/* ------------------------------------------------------------------ */

export async function getDimensions(): Promise<DimensionWithCounts[]> {
  const db = createAdminClient()
  const { data, error } = await db
    .from('dimensions')
    .select('*, factors(count)')
    .is('deleted_at', null)
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
    .is('deleted_at', null)
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

/* ------------------------------------------------------------------ */
/*  Create / Update / Delete                                           */
/* ------------------------------------------------------------------ */

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

  const { data, error } = await db
    .from('dimensions')
    .insert(insert)
    .select('id')
    .single()

  if (error) return { error: { _form: [error.message] } }

  revalidatePath('/dimensions')
  revalidatePath('/')
  return { success: true as const, id: data.id as string, slug: parsed.data.slug }
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
  return { success: true as const, id, slug: parsed.data.slug }
}

export async function deleteDimension(id: string) {
  const db = createAdminClient()
  const { error } = await db
    .from('dimensions')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/dimensions')
  revalidatePath('/')
  return { success: true as const }
}

/* ------------------------------------------------------------------ */
/*  Restore                                                            */
/* ------------------------------------------------------------------ */

export async function restoreDimension(id: string) {
  const db = createAdminClient()
  const { error } = await db
    .from('dimensions')
    .update({ deleted_at: null })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/dimensions')
  revalidatePath('/')
  return { success: true as const }
}

/* ------------------------------------------------------------------ */
/*  Toggle active                                                      */
/* ------------------------------------------------------------------ */

export async function toggleDimensionActive(id: string, isActive: boolean) {
  const db = createAdminClient()
  const { error } = await db
    .from('dimensions')
    .update({ is_active: isActive })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/dimensions')
  revalidatePath('/')
  return { success: true as const }
}

/* ------------------------------------------------------------------ */
/*  Auto-save single field                                             */
/* ------------------------------------------------------------------ */

const ALLOWED_FIELDS: Record<string, string> = {
  description: 'description',
  definition: 'definition',
  indicatorsLow: 'indicators_low',
  indicatorsMid: 'indicators_mid',
  indicatorsHigh: 'indicators_high',
}

export async function updateDimensionField(id: string, field: string, value: string) {
  const dbColumn = ALLOWED_FIELDS[field]
  if (!dbColumn) {
    return { error: `Field "${field}" is not allowed` }
  }

  const db = createAdminClient()
  const { error } = await db
    .from('dimensions')
    .update({ [dbColumn]: value || null })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/dimensions')
  return { success: true as const }
}
