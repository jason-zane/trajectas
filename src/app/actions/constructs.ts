'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { mapConstructRow, toConstructInsert } from '@/lib/supabase/mappers'
import { constructSchema } from '@/lib/validations/constructs'
import type { Construct } from '@/types/database'

export type ConstructWithCounts = Construct & {
  factorCount: number
  dimensionNames: string[]
}

export type ConstructWithRelationships = Construct & {
  linkedItems: { id: string; stem: string; status: string; responseFormatType?: string }[]
  parentFactors: { id: string; name: string; slug: string }[]
}

export async function getConstructs(): Promise<ConstructWithCounts[]> {
  const db = createAdminClient()

  // Two queries: count can't mix with nested relations in PostgREST
  const [countResult, relResult] = await Promise.all([
    db
      .from('constructs')
      .select('id, factor_constructs(count)')
      .order('name', { ascending: true }),
    db
      .from('constructs')
      .select('*, factor_constructs(factors(dimensions(name)))')
      .order('name', { ascending: true }),
  ])

  if (relResult.error) throw new Error(relResult.error.message)

  // Build count lookup
  const countMap = new Map<string, number>()
  for (const row of countResult.data ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = row as any
    countMap.set(r.id, r.factor_constructs?.[0]?.count ?? 0)
  }

  return (relResult.data ?? []).map((row) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = row as any
    const fcRows = r.factor_constructs ?? []

    // Collect dimension names through the factor chain
    const dimNames = new Set<string>()
    for (const fc of fcRows) {
      const dimName = fc.factors?.dimensions?.name
      if (dimName) dimNames.add(dimName)
    }

    return {
      ...mapConstructRow(row),
      factorCount: countMap.get(r.id) ?? 0,
      dimensionNames: Array.from(dimNames).sort(),
    }
  })
}

export async function getConstructBySlug(slug: string): Promise<ConstructWithRelationships | null> {
  const db = createAdminClient()
  const { data, error } = await db
    .from('constructs')
    .select('*, items(id, stem, status, response_formats(type)), factor_constructs(*, factors(id, name, slug))')
    .eq('slug', slug)
    .single()

  if (error) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = data as any
  return {
    ...mapConstructRow(data),
    linkedItems: (r.items ?? []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (item: any) => ({
        id: item.id,
        stem: item.stem,
        status: item.status,
        responseFormatType: item.response_formats?.type ?? undefined,
      })
    ),
    parentFactors: (r.factor_constructs ?? []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (fc: any) => ({
        id: fc.factors?.id ?? fc.factor_id,
        name: fc.factors?.name ?? '',
        slug: fc.factors?.slug ?? '',
      })
    ),
  }
}

export async function createConstruct(formData: FormData) {
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

  const parsed = constructSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const db = createAdminClient()
  const insert = toConstructInsert(parsed.data)
  const { error } = await db.from('constructs').insert(insert)
  if (error) return { error: { _form: [error.message] } }

  revalidatePath('/constructs')
  revalidatePath('/')
  redirect('/constructs')
}

export async function updateConstruct(id: string, formData: FormData) {
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

  const parsed = constructSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const db = createAdminClient()
  const { error } = await db
    .from('constructs')
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

export async function deleteConstruct(id: string) {
  const db = createAdminClient()
  const { error } = await db.from('constructs').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/constructs')
  revalidatePath('/')
  redirect('/constructs')
}
