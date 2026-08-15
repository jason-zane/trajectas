'use server'

/**
 * Practice-mode answer checking (LR-6 / #336).
 *
 * Immediate correct/incorrect feedback for items in a 'practice'-role
 * section, via a server round trip — the answer key
 * (item_answer_keys.correct_option_id) is read here with the service-role
 * client and NEVER returned to the caller. Only a derived boolean
 * (`correct`) plus, on an incorrect answer, an explanatory string
 * (`message`) cross back to the client.
 *
 * Authorization mirrors every other participant-runtime action in this
 * directory (see assess.ts): `requireParticipantRuntimeSessionAccess`
 * resolves and validates the access token against the session, throwing
 * ParticipantRuntimeAccessError on any mismatch.
 *
 * The load-bearing check beyond that is `resolvePracticeSectionItem` below:
 * without it, this action would be a same-shape answer-oracle for SCORED
 * items too — a participant could submit any itemId from the delivered
 * payload and instantly learn whether their guess was right, defeating the
 * entire answer-key-isolation design this feature otherwise upholds. The
 * item must resolve to a section with `section_role = 'practice'` on THIS
 * session's assessment, or the request is refused before the key is even
 * queried. This mirrors the SQL migration's own item-resolution query
 * shape (assessment_section_items JOIN assessment_sections WHERE
 * assessment_id = ... ORDER BY display_order — see
 * 20260814100000_lr6_practice_completion_gate.sql) but adds the
 * section_role = 'practice' filter that migration doesn't need (it only
 * ever *counts* practice items, never resolves one from an arbitrary
 * itemId supplied by a caller).
 *
 * Deliberately NOT listed in tests/architecture/answer-key-isolation.test
 * .ts's RUNNER_PATH_FILES. That guard scopes itself (see its own header
 * comment) to "the participant-facing runner path" — the code that
 * assembles/types what gets DISPLAYED — and explicitly excludes admin and
 * scoring code that "legitimately reads keys via the service-role client".
 * This module reads item_answer_keys.correct_option_id and
 * item_option_diagnostics for exactly that legitimate reason (to derive a
 * safe boolean), the same way src/lib/scoring/ability-session.ts and
 * src/lib/scoring/ctt-session.ts do — neither of which is in that list
 * either. Scanning this file for the literal identifiers would make the
 * feature impossible to implement in TypeScript without routing through a
 * new SQL RPC, which the task scope for this branch did not call for and
 * which would have re-run the full migration-collision risk already hit
 * once on this branch (see the 090000 -> 100000 rename). The NEW runner-
 * facing component this feature adds (practice-feedback.tsx, which only
 * ever sees `{ correct, message }`) IS added to that list instead — see
 * that test file's diff.
 *
 * @module
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { logActionError } from '@/lib/security/action-errors'
import {
  ParticipantRuntimeAccessError,
  requireParticipantRuntimeSessionAccess,
} from '@/lib/auth/participant-runtime'
import { checkPracticeAnswerInputSchema } from '@/lib/validations/assess'

export type PracticeAnswerCheck =
  | { correct: true }
  | { correct: false; message?: string }

type SectionRoleInfo = {
  id: string
  assessment_id: string
  section_role: string
  display_order: number
}

type SectionRoleRow = {
  display_order: number
  assessment_sections: SectionRoleInfo | SectionRoleInfo[] | null
}

/**
 * Resolve the (single) section a delivered item belongs to within the
 * given assessment, the same way the LR-6 SQL gate does: join
 * assessment_section_items -> assessment_sections, scoped to this
 * assessment, ordered by section display_order then item display_order so
 * the result is deterministic if an item were ever attached to more than
 * one section of the same assessment. Returns null if the item doesn't
 * belong to this assessment at all, or belongs to it but not via a
 * 'practice'-role section.
 */
async function resolvePracticeSectionItem(
  db: ReturnType<typeof createAdminClient>,
  assessmentId: string,
  itemId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data, error } = await db
    .from('assessment_section_items')
    .select('display_order, assessment_sections(id, assessment_id, section_role, display_order)')
    .eq('item_id', itemId)

  if (error) {
    logActionError('checkPracticeAnswer.resolveSection', error)
    return { ok: false, error: 'Unable to check this answer right now' }
  }

  type Candidate = { section: SectionRoleInfo; itemDisplayOrder: number }

  const candidates: Candidate[] = ((data ?? []) as SectionRoleRow[])
    .map((row): Candidate | null => {
      const section = Array.isArray(row.assessment_sections)
        ? row.assessment_sections[0]
        : row.assessment_sections
      return section ? { section, itemDisplayOrder: row.display_order } : null
    })
    .filter((r): r is Candidate => r !== null)
    .filter((r) => r.section.assessment_id === assessmentId)
    .sort(
      (a, b) =>
        a.section.display_order - b.section.display_order ||
        a.itemDisplayOrder - b.itemDisplayOrder,
    )

  const match = candidates[0]
  if (!match) {
    return { ok: false, error: 'This item is not part of the active assessment' }
  }
  if (match.section.section_role !== 'practice') {
    // The item is real, but not a practice item — refuse rather than leak
    // whether the guess against a SCORED item was right.
    return { ok: false, error: 'This item is not a practice item' }
  }
  return { ok: true }
}

/**
 * Check a practice-item response and return correctness plus, on a miss,
 * an explanatory message. Never returns the correct option itself.
 */
export async function checkPracticeAnswer(
  token: string,
  sessionId: string,
  itemId: string,
  chosenOptionId: string,
): Promise<PracticeAnswerCheck | { error: string }> {
  const parsed = checkPracticeAnswerInputSchema.safeParse({
    token,
    sessionId,
    itemId,
    chosenOptionId,
  })
  if (!parsed.success) {
    return { error: 'Invalid input' }
  }

  let access: Awaited<ReturnType<typeof requireParticipantRuntimeSessionAccess>>
  try {
    access = await requireParticipantRuntimeSessionAccess(token, sessionId)
  } catch (error) {
    if (error instanceof ParticipantRuntimeAccessError) {
      return { error: error.message }
    }
    throw error
  }

  const db = createAdminClient()

  const sectionCheck = await resolvePracticeSectionItem(db, access.assessmentId, itemId)
  if (!sectionCheck.ok) {
    return { error: sectionCheck.error }
  }

  // The chosen option must actually belong to this item — a mismatched id
  // can only come from a malformed/tampered request (the runner always
  // resolves it from the item's own delivered options), and resolving it
  // against the wrong item's diagnostics later would produce a nonsense
  // explanation. item_options_id_item_unique (id, item_id) is the same
  // composite the answer-key FK itself relies on (20260813100500).
  const { data: optionRow, error: optionErr } = await db
    .from('item_options')
    .select('id')
    .eq('id', chosenOptionId)
    .eq('item_id', itemId)
    .maybeSingle()
  if (optionErr) {
    logActionError('checkPracticeAnswer.option', optionErr)
    return { error: 'Unable to check this answer right now' }
  }
  if (!optionRow) {
    return { error: 'Invalid option for this item' }
  }

  const { data: keyRow, error: keyErr } = await db
    .from('item_answer_keys')
    .select('correct_option_id, rationale')
    .eq('item_id', itemId)
    .maybeSingle()
  if (keyErr) {
    logActionError('checkPracticeAnswer.key', keyErr)
    return { error: 'Unable to check this answer right now' }
  }
  if (!keyRow) {
    // A missing key must never resolve to a verdict — same principle as
    // ability-session.ts's scoring abort for a missing key, applied here to
    // a single check instead of a whole-session score.
    return { error: 'This item does not have an answer key configured' }
  }

  const isCorrectAnswer = keyRow.correct_option_id === chosenOptionId
  if (isCorrectAnswer) {
    return { correct: true }
  }

  // Prefer the per-distractor rationale for the option the participant
  // actually chose (item_option_diagnostics); fall back to the item's
  // general "why the right answer is right" rationale
  // (item_answer_keys.rationale) when no distractor-specific note exists.
  const { data: diagnosticRow, error: diagnosticErr } = await db
    .from('item_option_diagnostics')
    .select('rationale')
    .eq('option_id', chosenOptionId)
    .maybeSingle()
  if (diagnosticErr) {
    // Non-fatal: the verdict itself is still valid. Losing the explanation
    // loses helpfulness, not correctness — degrade to no message.
    logActionError('checkPracticeAnswer.diagnostic', diagnosticErr)
  }

  const message = diagnosticRow?.rationale ?? keyRow.rationale ?? undefined
  return { correct: false, message: message ?? undefined }
}
