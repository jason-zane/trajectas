import type { SupabaseClient } from '@supabase/supabase-js'
import { logActionError } from '@/lib/security/action-errors'

/**
 * Compare the assessment's item set against the session's saved responses.
 * Only items that currently belong to the assessment count — stale responses
 * to since-removed items neither help nor hurt.
 *
 * Backs the hard completeness gate in submitSession: an in-progress session
 * may only be completed once every item has a saved response.
 */
export async function getSessionCompleteness(
  db: SupabaseClient,
  sessionId: string,
  assessmentId: string | null,
): Promise<{ expected: number; answered: number } | { error: string }> {
  if (!assessmentId) {
    return { error: 'Unable to verify assessment completeness right now' }
  }

  const [itemsResult, responsesResult] = await Promise.all([
    db
      .from('assessment_section_items')
      .select('item_id, assessment_sections!inner(assessment_id)')
      .eq('assessment_sections.assessment_id', assessmentId),
    db
      .from('participant_responses')
      .select('item_id')
      .eq('session_id', sessionId),
  ])

  if (itemsResult.error) {
    logActionError('submitSession.completeness.items', itemsResult.error)
    return { error: 'Unable to verify assessment completeness right now' }
  }
  if (responsesResult.error) {
    logActionError('submitSession.completeness.responses', responsesResult.error)
    return { error: 'Unable to verify assessment completeness right now' }
  }

  const expectedIds = new Set(
    (itemsResult.data ?? []).map((row) => String(row.item_id)),
  )
  const answeredIds = new Set(
    (responsesResult.data ?? []).map((row) => String(row.item_id)),
  )
  let answered = 0
  for (const id of expectedIds) {
    if (answeredIds.has(id)) answered++
  }
  return { expected: expectedIds.size, answered }
}
