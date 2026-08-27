// =============================================================================
// src/lib/chat/tools/find-assessment.ts
//
// Resolve an assessment (the instrument) the user named. Query lives in the
// DAL; tenancy comes from the assessments SELECT policy on the caller's
// connection.
// =============================================================================

import 'server-only'

import { z } from 'zod'
import { defineChatTool } from '../registry'
import { toolOk, toolFail, type ChatBlock } from '../envelope'
import {
  searchAssessments,
  ChatSearchError,
  CHAT_SEARCH_LIMIT,
} from '@/lib/dal/chat-search'

export const findAssessmentTool = defineChatTool({
  name: 'find_assessment',
  description:
    'Find assessments (the instruments themselves) by title. Returns assessment ids. Call with no query to list the assessments visible to the user.',
  statusLabel: 'Searching assessments',
  params: z.object({
    query: z
      .string()
      .max(120)
      .optional()
      .describe('Part of the assessment title. Omit to list all visible assessments.'),
  }),
  async execute({ query }, { db }) {
    let assessments
    try {
      assessments = await searchAssessments(db, { term: query })
    } catch (error) {
      const message = error instanceof ChatSearchError ? error.message : 'lookup failed'
      return toolFail('unavailable', `Assessment lookup failed: ${message}`)
    }

    const term = query?.trim()
    if (assessments.length === 0) {
      return toolFail(
        'not_found',
        term
          ? `No assessment matching "${term}" is visible to you.`
          : 'No assessments are visible to you.',
      )
    }

    return toolOk(
      {
        matchCount: assessments.length,
        truncated: assessments.length === CHAT_SEARCH_LIMIT,
        assessments,
      },
      {
        source: 'assessments',
        deepLink: assessments.length === 1 ? assessments[0].href : null,
        caveats:
          assessments.length === CHAT_SEARCH_LIMIT
            ? [`Only the first ${CHAT_SEARCH_LIMIT} matches are shown.`]
            : [],
      },
    )
  },
  toBlocks(data): ChatBlock[] {
    if (data.assessments.length === 0) return []
    return [
      {
        kind: 'entity_links',
        v: 1,
        title: 'Assessments',
        links: data.assessments.map((row) => ({
          kind: 'assessment' as const,
          id: row.assessmentId,
          label: row.title ?? 'Untitled',
          sublabel: row.clientName ?? null,
          href: row.href,
        })),
      },
    ]
  },
})
