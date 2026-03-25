'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { mapOrganizationRow, toOrganizationInsert } from '@/lib/supabase/mappers'
import { organizationSchema } from '@/lib/validations/organizations'
import type { Organization } from '@/types/database'

export type OrganizationWithCounts = Organization & {
  assessmentCount: number
  sessionCount: number
}

export async function getOrganizations(): Promise<OrganizationWithCounts[]> {
  const db = createAdminClient()
  const { data, error } = await db
    .from('organizations')
    .select('*, assessments(count), diagnostic_sessions(count)')
    .order('name', { ascending: true })

  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => ({
    ...mapOrganizationRow(row),
    assessmentCount: (row as Record<string, unknown>).assessments
      ? ((row as Record<string, unknown>).assessments as { count: number }[])[0]?.count ?? 0
      : 0,
    sessionCount: (row as Record<string, unknown>).diagnostic_sessions
      ? ((row as Record<string, unknown>).diagnostic_sessions as { count: number }[])[0]?.count ?? 0
      : 0,
  }))
}

export async function getOrganizationBySlug(slug: string): Promise<Organization | null> {
  const db = createAdminClient()
  const { data, error } = await db
    .from('organizations')
    .select('*')
    .eq('slug', slug)
    .single()

  if (error) return null
  return mapOrganizationRow(data)
}

export async function createOrganization(formData: FormData) {
  const raw = {
    name: formData.get('name') as string,
    slug: formData.get('slug') as string,
    industry: (formData.get('industry') as string) || undefined,
    sizeRange: (formData.get('sizeRange') as string) || undefined,
    isActive: formData.get('isActive') !== 'false',
  }

  const parsed = organizationSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const db = createAdminClient()
  const insert = toOrganizationInsert({
    name: parsed.data.name,
    slug: parsed.data.slug,
    industry: parsed.data.industry,
    sizeRange: parsed.data.sizeRange,
    isActive: parsed.data.isActive,
  })

  const { error } = await db.from('organizations').insert(insert)
  if (error) return { error: { _form: [error.message] } }

  revalidatePath('/organizations')
  revalidatePath('/')
  redirect('/organizations')
}

export async function updateOrganization(id: string, formData: FormData) {
  const raw = {
    name: formData.get('name') as string,
    slug: formData.get('slug') as string,
    industry: (formData.get('industry') as string) || undefined,
    sizeRange: (formData.get('sizeRange') as string) || undefined,
    isActive: formData.get('isActive') !== 'false',
  }

  const parsed = organizationSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const db = createAdminClient()
  const { error } = await db
    .from('organizations')
    .update({
      name: parsed.data.name,
      slug: parsed.data.slug,
      industry: parsed.data.industry ?? null,
      size_range: parsed.data.sizeRange ?? null,
      is_active: parsed.data.isActive,
    })
    .eq('id', id)

  if (error) return { error: { _form: [error.message] } }

  revalidatePath('/organizations')
  revalidatePath('/')
  redirect('/organizations')
}

export async function deleteOrganization(id: string) {
  const db = createAdminClient()
  const { error } = await db.from('organizations').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/organizations')
  revalidatePath('/')
  redirect('/organizations')
}
