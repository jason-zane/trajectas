'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { mapFactorRow } from '@/lib/supabase/mappers'
import { factorSchema } from '@/lib/validations/factors'
import type { Factor } from '@/types/database'

export type FactorWithMeta = Factor & {
  dimensionName?: string
  organizationName?: string
  constructCount: number
  itemCount: number
  assessmentCount: number
}

export type LinkedAssessment = { id: string; name: string; status: string }

export type SelectOption = { id: string; name: string }

export async function getFactors(): Promise<FactorWithMeta[]> {
  const db = createAdminClient()
  const { data, error } = await db
    .from('factors')
    .select('*, dimensions(name), organizations(name), factor_constructs(count), items(count), assessment_competencies(count)')
    .is('deleted_at', null)
    .order('name', { ascending: true })

  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = row as any
    return {
      ...mapFactorRow(row),
      dimensionName: r.dimensions?.name ?? undefined,
      organizationName: r.organizations?.name ?? undefined,
      constructCount: r.factor_constructs?.[0]?.count ?? 0,
      itemCount: r.items?.[0]?.count ?? 0,
      assessmentCount: r.assessment_competencies?.[0]?.count ?? 0,
    }
  })
}

export async function getFactorBySlug(slug: string) {
  const db = createAdminClient()
  const { data, error } = await db
    .from('factors')
    .select('*, dimensions(name), organizations(name), factor_constructs(*, constructs(id, name, slug)), assessment_competencies(assessment_id, assessments(id, name, status))')
    .eq('slug', slug)
    .is('deleted_at', null)
    .single()

  if (error) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = data as any
  return {
    ...mapFactorRow(data),
    dimensionName: r.dimensions?.name ?? undefined,
    organizationName: r.organizations?.name ?? undefined,
    linkedConstructs: (r.factor_constructs ?? []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (fc: any) => ({
        id: fc.id,
        constructId: fc.construct_id,
        name: fc.constructs?.name ?? '',
        weight: Number(fc.weight),
        displayOrder: fc.display_order,
      })
    ),
    linkedAssessments: (r.assessment_competencies ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((ac: any) => ac.assessments)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((ac: any) => ({
        id: ac.assessments.id,
        name: ac.assessments.name,
        status: ac.assessments.status,
      })) as LinkedAssessment[],
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

export async function getConstructsForSelect(): Promise<SelectOption[]> {
  const db = createAdminClient()
  const { data, error } = await db
    .from('constructs')
    .select('id, name')
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getOrganizationsForFactorSelect(): Promise<SelectOption[]> {
  const db = createAdminClient()
  const { data, error } = await db
    .from('organizations')
    .select('id, name')
    .order('name')

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function createFactor(formData: FormData) {
  const constructsJson = formData.get('constructs') as string
  let constructs: { constructId: string; weight: number }[] = []
  try {
    constructs = constructsJson ? JSON.parse(constructsJson) : []
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
    isMatchEligible: formData.get('isMatchEligible') !== 'false',
    organizationId: (formData.get('organizationId') as string) || undefined,
    constructs,
    indicatorsLow: (formData.get('indicatorsLow') as string) || undefined,
    indicatorsMid: (formData.get('indicatorsMid') as string) || undefined,
    indicatorsHigh: (formData.get('indicatorsHigh') as string) || undefined,
  }

  const parsed = factorSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const db = createAdminClient()
  const newId = crypto.randomUUID()

  // Atomic upsert via RPC
  const { data: factorId, error: rpcErr } = await db.rpc('upsert_factor_with_constructs', {
    p_factor_id: newId,
    p_factor: {
      name: parsed.data.name,
      slug: parsed.data.slug,
      description: parsed.data.description ?? null,
      definition: parsed.data.definition ?? null,
      dimension_id: parsed.data.dimensionId || null,
      is_active: parsed.data.isActive,
      is_match_eligible: parsed.data.isMatchEligible,
      organization_id: parsed.data.organizationId || null,
      indicators_low: parsed.data.indicatorsLow ?? null,
      indicators_mid: parsed.data.indicatorsMid ?? null,
      indicators_high: parsed.data.indicatorsHigh ?? null,
    },
    p_construct_links: parsed.data.constructs.map((c, i) => ({
      construct_id: c.constructId,
      weight: c.weight,
      display_order: i + 1,
    })),
  })

  if (rpcErr) return { error: { _form: [rpcErr.message] } }

  revalidatePath('/factors')
  revalidatePath('/')
  return { success: true, id: factorId ?? newId, slug: parsed.data.slug }
}

export async function updateFactor(id: string, formData: FormData) {
  const constructsJson = formData.get('constructs') as string
  let constructs: { constructId: string; weight: number }[] = []
  try {
    constructs = constructsJson ? JSON.parse(constructsJson) : []
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
    isMatchEligible: formData.get('isMatchEligible') !== 'false',
    organizationId: (formData.get('organizationId') as string) || undefined,
    constructs,
    indicatorsLow: (formData.get('indicatorsLow') as string) || undefined,
    indicatorsMid: (formData.get('indicatorsMid') as string) || undefined,
    indicatorsHigh: (formData.get('indicatorsHigh') as string) || undefined,
  }

  const parsed = factorSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const db = createAdminClient()

  // Atomic upsert via RPC
  const { error: rpcErr } = await db.rpc('upsert_factor_with_constructs', {
    p_factor_id: id,
    p_factor: {
      name: parsed.data.name,
      slug: parsed.data.slug,
      description: parsed.data.description ?? null,
      definition: parsed.data.definition ?? null,
      dimension_id: parsed.data.dimensionId || null,
      is_active: parsed.data.isActive,
      is_match_eligible: parsed.data.isMatchEligible,
      organization_id: parsed.data.organizationId || null,
      indicators_low: parsed.data.indicatorsLow ?? null,
      indicators_mid: parsed.data.indicatorsMid ?? null,
      indicators_high: parsed.data.indicatorsHigh ?? null,
    },
    p_construct_links: parsed.data.constructs.map((c, i) => ({
      construct_id: c.constructId,
      weight: c.weight,
      display_order: i + 1,
    })),
  })

  if (rpcErr) return { error: { _form: [rpcErr.message] } }

  revalidatePath('/factors')
  revalidatePath('/')
  return { success: true, id, slug: parsed.data.slug }
}

export async function deleteFactor(id: string) {
  const db = createAdminClient()
  const { error } = await db
    .from('factors')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/factors')
  revalidatePath('/')
  return { success: true }
}

export async function restoreFactor(id: string) {
  const db = createAdminClient()
  const { error } = await db
    .from('factors')
    .update({ deleted_at: null })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/factors')
  revalidatePath('/')
  return { success: true }
}

export async function toggleFactorActive(id: string, isActive: boolean) {
  const db = createAdminClient()
  const { error } = await db
    .from('factors')
    .update({ is_active: isActive })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/factors')
  revalidatePath('/')
  return { success: true }
}

const ALLOWED_FACTOR_FIELDS = ['description', 'definition', 'indicators_low', 'indicators_mid', 'indicators_high'] as const
type AllowedFactorField = typeof ALLOWED_FACTOR_FIELDS[number]

const camelToSnakeMap: Record<string, AllowedFactorField> = {
  description: 'description',
  definition: 'definition',
  indicatorsLow: 'indicators_low',
  indicatorsMid: 'indicators_mid',
  indicatorsHigh: 'indicators_high',
}

export async function updateFactorField(id: string, field: string, value: string) {
  const dbField = camelToSnakeMap[field] ?? field
  if (!ALLOWED_FACTOR_FIELDS.includes(dbField as AllowedFactorField)) {
    return { error: `Field "${field}" is not allowed` }
  }

  const db = createAdminClient()
  const { error } = await db
    .from('factors')
    .update({ [dbField]: value || null })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/factors')
  return { success: true }
}
