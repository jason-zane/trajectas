'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import type { AIPromptPurpose } from '@/types/database'

export interface PromptVersionRow {
  id: string
  name: string
  purpose: AIPromptPurpose
  content: string
  version: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface PromptSummaryRow {
  purpose: AIPromptPurpose
  activePrompt: PromptVersionRow | null
  versionCount: number
}

function mapPromptRow(row: Record<string, unknown>): PromptVersionRow {
  return {
    id: row.id as string,
    name: row.name as string,
    purpose: row.purpose as AIPromptPurpose,
    content: row.content as string,
    version: row.version as number,
    isActive: row.is_active as boolean,
    createdAt: row.created_at as string,
    updatedAt: (row.updated_at as string | null) ?? (row.created_at as string),
  }
}

export async function getPromptSummaries(): Promise<PromptSummaryRow[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('ai_system_prompts')
    .select('id, name, purpose, content, version, is_active, created_at, updated_at')
    .order('purpose')
    .order('version', { ascending: false })

  if (error) throw new Error(error.message)

  const summaries = new Map<AIPromptPurpose, PromptSummaryRow>()

  for (const row of (data ?? []) as Record<string, unknown>[]) {
    const prompt = mapPromptRow(row)
    const existing = summaries.get(prompt.purpose)
    if (!existing) {
      summaries.set(prompt.purpose, {
        purpose: prompt.purpose,
        activePrompt: prompt.isActive ? prompt : null,
        versionCount: 1,
      })
      continue
    }

    existing.versionCount += 1
    if (prompt.isActive) {
      existing.activePrompt = prompt
    }
  }

  return Array.from(summaries.values())
}

export async function getPromptVersions(
  purpose: AIPromptPurpose,
): Promise<PromptVersionRow[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('ai_system_prompts')
    .select('id, name, purpose, content, version, is_active, created_at, updated_at')
    .eq('purpose', purpose)
    .order('version', { ascending: false })

  if (error) throw new Error(error.message)
  return ((data ?? []) as Record<string, unknown>[]).map(mapPromptRow)
}

export async function createPromptVersion(
  purpose: AIPromptPurpose,
  content: string,
  name?: string,
): Promise<{ success: true } | { error: string }> {
  const trimmed = content.trim()
  if (!trimmed) {
    return { error: 'Prompt content cannot be empty.' }
  }

  const supabase = createAdminClient()
  const existingVersions = await getPromptVersions(purpose)
  const promptName = name?.trim() || existingVersions[0]?.name || purpose

  const { error } = await supabase.rpc('activate_ai_system_prompt', {
    p_purpose: purpose,
    p_name: promptName,
    p_content: trimmed,
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/settings/prompts')
  return { success: true }
}

/**
 * Activate an existing prompt version by ID.
 * Deactivates all other versions for the same purpose.
 */
export async function activatePromptVersion(
  purpose: AIPromptPurpose,
  versionId: string,
): Promise<{ success: true } | { error: string }> {
  const supabase = createAdminClient()

  // Deactivate all versions for this purpose
  const { error: deactivateError } = await supabase
    .from('ai_system_prompts')
    .update({ is_active: false })
    .eq('purpose', purpose)

  if (deactivateError) return { error: deactivateError.message }

  // Activate the target version
  const { error: activateError } = await supabase
    .from('ai_system_prompts')
    .update({ is_active: true })
    .eq('id', versionId)

  if (activateError) return { error: activateError.message }

  revalidatePath('/settings/prompts')
  return { success: true }
}
